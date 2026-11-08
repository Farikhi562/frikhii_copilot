package intelligence

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"
)

// Analyzer asks the AI Engine for narrative insights from an evidence digest. Its output
// is untrusted: the service validates it before anything is stored.
type Analyzer interface {
	Analyze(ctx context.Context, digest []EvidenceDigest, prefs Preferences) ([]AIInsight, error)
}

// Router is the subset of chi.Router the handler needs.
type Router interface {
	Get(pattern string, h http.HandlerFunc)
	Post(pattern string, h http.HandlerFunc)
	Patch(pattern string, h http.HandlerFunc)
}

// Handler exposes the learner-intelligence API. UserID must return the authenticated user
// id placed on the request context by the existing authentication middleware.
type Handler struct {
	Svc      *Service
	UserID   func(*http.Request) string
	Analyzer Analyzer // optional; nil disables AI insights
}

func (h *Handler) Mount(r Router) {
	r.Post("/intelligence/events", h.postEvent)
	r.Get("/intelligence/overview", h.getOverview)
	// POST, not PUT: the existing CORS middleware only allows GET, POST, PATCH.
	r.Post("/intelligence/preferences", h.putPreferences)
	r.Patch("/intelligence/insights", h.patchInsight)
	r.Post("/intelligence/insights/generate", h.generateInsights)
	r.Get("/intelligence/tutor-guidance", h.getTutorGuidance)
	r.Post("/intelligence/reset", h.reset)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]any{"error": map[string]any{"code": code, "message": msg}})
}

func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalid):
		writeErr(w, http.StatusBadRequest, "invalid_request", strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": "))
	case errors.Is(err, ErrUnknownCmp):
		writeErr(w, http.StatusUnprocessableEntity, "unknown_competency", "That competency is not part of this course.")
	case errors.Is(err, ErrNotFound):
		writeErr(w, http.StatusNotFound, "not_found", "The requested resource was not found.")
	default:
		slog.Error("intelligence_request_failed", "error", err, "path", r.URL.Path)
		writeErr(w, http.StatusInternalServerError, "internal_error", "Something went wrong.")
	}
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid_request_body", "The request body is invalid.")
		return false
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		writeErr(w, http.StatusBadRequest, "invalid_request_body", "The request body must contain one JSON object.")
		return false
	}
	return true
}

func (h *Handler) user(w http.ResponseWriter, r *http.Request) (string, bool) {
	u := h.UserID(r)
	if u == "" {
		writeErr(w, http.StatusUnauthorized, "unauthorized", "Authentication is required.")
		return "", false
	}
	return u, true
}

func (h *Handler) postEvent(w http.ResponseWriter, r *http.Request) {
	u, ok := h.user(w, r)
	if !ok {
		return
	}
	var in EventInput
	if !decode(w, r, &in) {
		return
	}
	res, err := h.Svc.RecordEvent(r.Context(), u, in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	status := http.StatusCreated
	if res.Duplicate {
		status = http.StatusOK
	}
	writeJSON(w, status, res)
}

type courseView struct {
	CourseID        string              `json:"course_id"`
	Records         []Record            `json:"competencies"`
	Gaps            []Gap               `json:"knowledge_gaps"`
	Recommendations []Recommendation    `json:"recommendations"`
	Reviews         []ReviewItem        `json:"reviews"`
	Insights        []Insight           `json:"insights"`
	Prerequisites   map[string][]string `json:"prerequisites,omitempty"`
}

func (h *Handler) getOverview(w http.ResponseWriter, r *http.Request) {
	u, ok := h.user(w, r)
	if !ok {
		return
	}
	snaps, prefs, err := h.Svc.Overview(r.Context(), u)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	views := make([]courseView, 0, len(snaps))
	for _, s := range snaps {
		v := courseView{CourseID: s.CourseID, Gaps: nz(s.Gaps), Recommendations: nzr(s.Recommendations), Reviews: nzv(s.Reviews), Insights: nzi(s.Insights), Records: []Record{}}
		for _, k := range sortedKeys(s.Records) {
			v.Records = append(v.Records, s.Records[k])
		}
		if info, err := h.Svc.repo.CourseInfo(r.Context(), u, s.CourseID); err == nil {
			v.Prerequisites = info.Prerequisites
		}
		views = append(views, v)
	}
	sort.Slice(views, func(i, j int) bool { return views[i].CourseID < views[j].CourseID })
	writeJSON(w, http.StatusOK, map[string]any{"courses": views, "preferences": prefs})
}

func nz(v []Gap) []Gap {
	if v == nil {
		return []Gap{}
	}
	return v
}
func nzr(v []Recommendation) []Recommendation {
	if v == nil {
		return []Recommendation{}
	}
	return v
}
func nzv(v []ReviewItem) []ReviewItem {
	if v == nil {
		return []ReviewItem{}
	}
	return v
}
func nzi(v []Insight) []Insight {
	if v == nil {
		return []Insight{}
	}
	return v
}

func (h *Handler) putPreferences(w http.ResponseWriter, r *http.Request) {
	u, ok := h.user(w, r)
	if !ok {
		return
	}
	var p Preferences
	if !decode(w, r, &p) {
		return
	}
	saved, err := h.Svc.SavePreferences(r.Context(), u, p)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"preferences": saved})
}

func (h *Handler) patchInsight(w http.ResponseWriter, r *http.Request) {
	u, ok := h.user(w, r)
	if !ok {
		return
	}
	var body struct {
		ID     string `json:"id"`
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if !decode(w, r, &body) {
		return
	}
	if body.ID == "" {
		writeErr(w, http.StatusBadRequest, "invalid_request", "id is required")
		return
	}
	if err := h.Svc.CorrectInsight(r.Context(), u, body.ID, body.Status, body.Note); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

func (h *Handler) generateInsights(w http.ResponseWriter, r *http.Request) {
	u, ok := h.user(w, r)
	if !ok {
		return
	}
	var body struct {
		CourseID string `json:"course_id"`
	}
	if !decode(w, r, &body) {
		return
	}
	if h.Analyzer == nil {
		writeErr(w, http.StatusBadGateway, "ai_unavailable", "AI insights are not available right now. Rule-based insights still work.")
		return
	}
	digest, err := h.Svc.Digest(r.Context(), u, body.CourseID)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	if len(digest) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"stored": 0, "message": "There is no learning evidence yet, so no insights were generated."})
		return
	}
	prefs, err := h.Svc.Preferences(r.Context(), u)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	raw, err := h.Analyzer.Analyze(r.Context(), digest, prefs)
	if err != nil {
		slog.Warn("ai_insights_failed", "error", err)
		writeErr(w, http.StatusBadGateway, "ai_unavailable", "The AI service could not produce insights. Your data was not changed.")
		return
	}
	n, err := h.Svc.StoreAIInsights(r.Context(), u, body.CourseID, raw)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"stored": n, "rejected": len(raw) - n})
}

func (h *Handler) getTutorGuidance(w http.ResponseWriter, r *http.Request) {
	u, ok := h.user(w, r)
	if !ok {
		return
	}
	course, comp := r.URL.Query().Get("course_id"), strings.TrimSpace(r.URL.Query().Get("competency"))
	if course == "" || comp == "" {
		writeErr(w, http.StatusBadRequest, "invalid_request", "course_id and competency are required")
		return
	}
	g, err := h.Svc.TutorGuidance(r.Context(), u, course, comp)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"guidance": g})
}

func (h *Handler) reset(w http.ResponseWriter, r *http.Request) {
	u, ok := h.user(w, r)
	if !ok {
		return
	}
	var body struct {
		Confirm string `json:"confirm"`
	}
	if !decode(w, r, &body) {
		return
	}
	if body.Confirm != "RESET" {
		writeErr(w, http.StatusBadRequest, "invalid_request", `Send {"confirm":"RESET"} to delete your learner intelligence data.`)
		return
	}
	if err := h.Svc.Reset(r.Context(), u); err != nil {
		h.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "reset"})
}
