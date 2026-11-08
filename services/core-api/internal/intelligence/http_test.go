package intelligence

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type fakeAnalyzer struct {
	out []AIInsight
	err error
}

func (f fakeAnalyzer) Analyze(context.Context, []EvidenceDigest, Preferences) ([]AIInsight, error) {
	return f.out, f.err
}

type mux struct{ *http.ServeMux }

func (m mux) Get(p string, h http.HandlerFunc)   { m.HandleFunc("GET "+p, h) }
func (m mux) Post(p string, h http.HandlerFunc)  { m.HandleFunc("POST "+p, h) }
func (m mux) Patch(p string, h http.HandlerFunc) { m.HandleFunc("PATCH "+p, h) }

func server(t *testing.T, an Analyzer) (*httptest.Server, *harness) {
	h := newHarness()
	handler := &Handler{Svc: h.svc, Analyzer: an, UserID: func(r *http.Request) string { return r.Header.Get("X-Test-User") }}
	m := mux{http.NewServeMux()}
	handler.Mount(m)
	srv := httptest.NewServer(m)
	t.Cleanup(srv.Close)
	return srv, h
}

func call(t *testing.T, method, url, user, body string) (int, map[string]any) {
	req, _ := http.NewRequest(method, url, strings.NewReader(body))
	if user != "" {
		req.Header.Set("X-Test-User", user)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var out map[string]any
	_ = json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

func TestHTTPRequiresAuthentication(t *testing.T) {
	srv, _ := server(t, nil)
	for _, c := range [][2]string{{"GET", "/intelligence/overview"}, {"POST", "/intelligence/events"}, {"POST", "/intelligence/preferences"}, {"POST", "/intelligence/reset"}, {"GET", "/intelligence/tutor-guidance?course_id=a&competency=b"}} {
		if code, _ := call(t, c[0], srv.URL+c[1], "", `{}`); code != http.StatusUnauthorized {
			t.Fatalf("%v: got %d", c, code)
		}
	}
}

func TestHTTPEventFlowAndDuplicate(t *testing.T) {
	srv, _ := server(t, nil)
	body := `{"course_id":"course-1","competency":"Derivatives","event_type":"assessment_result","score":0.8,"idempotency_key":"abcdefgh-1"}`
	code, out := call(t, "POST", srv.URL+"/intelligence/events", ariaID, body)
	if code != 201 || out["record"] == nil {
		t.Fatalf("%d %v", code, out)
	}
	code, out = call(t, "POST", srv.URL+"/intelligence/events", ariaID, body)
	if code != 200 || out["duplicate"] != true {
		t.Fatalf("%d %v", code, out)
	}
	code, out = call(t, "GET", srv.URL+"/intelligence/overview", ariaID, "")
	if code != 200 || len(out["courses"].([]any)) != 1 {
		t.Fatalf("%d %v", code, out)
	}
	code, out = call(t, "GET", srv.URL+"/intelligence/overview", budiID, "")
	if code != 200 || len(out["courses"].([]any)) != 0 {
		t.Fatalf("another user must see nothing: %d %v", code, out)
	}
}

func TestHTTPRejectsBadInput(t *testing.T) {
	srv, _ := server(t, nil)
	cases := map[string]int{
		`{"course_id":"course-1","competency":"Derivatives","event_type":"assessment_result","score":3,"idempotency_key":"abcdefgh"}`:         400,
		`{"course_id":"course-1","competency":"Derivatives","event_type":"assessment_result","score":0.5,"idempotency_key":"abcdefgh","x":1}`: 400,
		`{"course_id":"course-1","competency":"Nope","event_type":"assessment_result","score":0.5,"idempotency_key":"abcdefgh"}`:              422,
		`{"course_id":"course-b","competency":"Derivatives","event_type":"assessment_result","score":0.5,"idempotency_key":"abcdefgh"}`:       404,
		`not json`: 400,
	}
	for body, want := range cases {
		if code, _ := call(t, "POST", srv.URL+"/intelligence/events", ariaID, body); code != want {
			t.Errorf("%s -> %d want %d", body, code, want)
		}
	}
}

func TestHTTPPreferencesAndReset(t *testing.T) {
	srv, _ := server(t, nil)
	if code, _ := call(t, "POST", srv.URL+"/intelligence/preferences", ariaID, `{"explanation_style":"simple","example_style":"visual","pace":"slow","preferred_language":"id-ID","short_term_target":"","long_term_target":""}`); code != 200 {
		t.Fatalf("save prefs: %d", code)
	}
	if code, _ := call(t, "POST", srv.URL+"/intelligence/preferences", ariaID, `{"explanation_style":"loud","example_style":"visual","pace":"slow","preferred_language":"id-ID"}`); code != 400 {
		t.Fatalf("invalid prefs: %d", code)
	}
	if code, _ := call(t, "POST", srv.URL+"/intelligence/reset", ariaID, `{"confirm":"yes"}`); code != 400 {
		t.Fatalf("reset needs explicit confirmation: %d", code)
	}
	if code, _ := call(t, "POST", srv.URL+"/intelligence/reset", ariaID, `{"confirm":"RESET"}`); code != 200 {
		t.Fatalf("reset: %d", code)
	}
}

func TestHTTPAIFailureDoesNotBreakRules(t *testing.T) {
	srv, _ := server(t, fakeAnalyzer{err: errors.New("provider down")})
	call(t, "POST", srv.URL+"/intelligence/events", ariaID, `{"course_id":"course-1","competency":"Derivatives","event_type":"assessment_result","score":0.4,"idempotency_key":"abcdefgh-1"}`)
	code, out := call(t, "POST", srv.URL+"/intelligence/insights/generate", ariaID, `{"course_id":"course-1"}`)
	if code != 502 || out["error"] == nil {
		t.Fatalf("%d %v", code, out)
	}
	if code, _ := call(t, "GET", srv.URL+"/intelligence/overview", ariaID, ""); code != 200 {
		t.Fatal("overview must still work when AI is down")
	}
}

func TestHTTPInvalidAIOutputIsRejected(t *testing.T) {
	srv, _ := server(t, fakeAnalyzer{out: []AIInsight{{Kind: "pattern", Statement: "Invented evidence reference.", Rationale: "No such event exists at all.", EvidenceEventIDs: []string{"ev-777"}, Confidence: "high"}}})
	call(t, "POST", srv.URL+"/intelligence/events", ariaID, `{"course_id":"course-1","competency":"Derivatives","event_type":"assessment_result","score":0.4,"idempotency_key":"abcdefgh-1"}`)
	code, out := call(t, "POST", srv.URL+"/intelligence/insights/generate", ariaID, `{"course_id":"course-1"}`)
	if code != 200 || out["stored"].(float64) != 0 || out["rejected"].(float64) != 1 {
		t.Fatalf("%d %v", code, out)
	}
}

func TestHTTPAIWithoutAnalyzerAndEmptyHistory(t *testing.T) {
	srv, _ := server(t, nil)
	if code, _ := call(t, "POST", srv.URL+"/intelligence/insights/generate", ariaID, `{"course_id":"course-1"}`); code != 502 {
		t.Fatalf("no analyzer must say unavailable: %d", code)
	}
	srv2, _ := server(t, fakeAnalyzer{})
	code, out := call(t, "POST", srv2.URL+"/intelligence/insights/generate", ariaID, `{"course_id":"course-1"}`)
	if code != 200 || out["stored"].(float64) != 0 {
		t.Fatalf("empty history: %d %v", code, out)
	}
}

func TestHTTPTutorGuidanceMissingHistory(t *testing.T) {
	srv, _ := server(t, nil)
	code, out := call(t, "GET", srv.URL+"/intelligence/tutor-guidance?course_id=course-1&competency=Derivatives", ariaID, "")
	g := out["guidance"].(map[string]any)
	if code != 200 || g["approach"] != "standard" || g["certainty"] != "low" {
		t.Fatalf("%d %v", code, out)
	}
	if code, _ := call(t, "GET", srv.URL+"/intelligence/tutor-guidance?course_id=course-b&competency=Derivatives", ariaID, ""); code != 404 {
		t.Fatalf("other user's course: %d", code)
	}
}
