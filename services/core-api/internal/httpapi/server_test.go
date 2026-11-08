package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/config"
	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/frikhii/copilot/core-api/internal/store"
)

const (
	apiTestUser   = "11111111-1111-1111-1111-111111111111"
	apiOtherUser  = "22222222-2222-2222-2222-222222222222"
	internalToken = "test-internal-token"
)

type fakeAI struct {
	mu               sync.Mutex
	failCourse       bool
	invalidCourse    bool
	lastCorrections  string
	lastAdditional   string
	lastPrevious     string
	lastChatMode     string
	lastChatContext  *aiclient.ChatContext
	lastChatMessages []aiclient.ChatMessage
}

func (f *fakeAI) setFailure(fail, invalid bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.failCourse = fail
	f.invalidCourse = invalid
}

func (f *fakeAI) handler(t *testing.T) http.Handler {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok", "mock_provider": true})
	})
	mux.HandleFunc("/internal/v1/diagnostic/generate", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Internal-Token") != internalToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		var request aiclient.DiagnosticGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode diagnostic request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		questions := []aiclient.AIQuestion{}
		keys := []domain.AnswerKey{}
		for index := 1; index <= 6; index++ {
			id := "q-" + string(rune('0'+index))
			questions = append(questions, aiclient.AIQuestion{
				ID: id, Sequence: index, Type: "short_answer",
				Prompt:     "Explain a core concept in your own words.",
				Competency: "basics", Difficulty: "foundation", Choices: []domain.Choice{},
				Explanation: "The explanation is withheld from the learner.",
			})
			keys = append(keys, domain.AnswerKey{
				QuestionID: id, ExpectedAnswer: "A clear, accurate explanation.",
				Rubric: []domain.RubricCriterion{{Criterion: "accuracy", Description: "Accurate.", Weight: 1}},
			})
		}
		_ = json.NewEncoder(w).Encode(aiclient.DiagnosticGenerationResponse{
			QuestionSet: aiclient.DiagnosticQuestionSet{
				Analysis: aiclient.TopicAnalysis{
					NormalizedTopic: "go", Summary: "A practical topic.", Complexity: "medium",
					Competencies: []domain.Competency{{ID: "comp-1", Name: "Basics", Description: "Core basics."}},
				},
				Questions: questions, EstimatedMinutes: 12,
			},
			AnswerKeys: keys,
			Metadata:   fakeMetadata(),
		})
	})
	mux.HandleFunc("/internal/v1/diagnostic/evaluate", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Internal-Token") != internalToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		var request aiclient.DiagnosticEvaluateRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode evaluation request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		scores := []domain.QuestionScore{}
		for _, question := range request.Questions {
			scores = append(scores, domain.QuestionScore{QuestionID: question.ID, Score: 70, Feedback: "A reasonable answer."})
		}
		_ = json.NewEncoder(w).Encode(aiclient.DiagnosticEvaluationResponse{
			Evaluation: domain.DiagnosticEvaluation{
				EstimatedLevel: "beginner", Confidence: "medium",
				Summary:        "You have a usable foundation.",
				Strengths:      []domain.Strength{{Competency: "basics", Evidence: "Answered consistently."}},
				Gaps:           []domain.KnowledgeGap{{Competency: "testing", Description: "Needs practice.", Severity: "medium", Recommendation: "Add tests."}},
				Misconceptions: []string{}, RecommendedStart: "Foundations",
				Rationale:      "The answers show baseline knowledge.",
				QuestionScores: scores, CanSkip: []string{},
			},
			Metadata: fakeMetadata(),
		})
	})
	mux.HandleFunc("/internal/v1/course/generate", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Internal-Token") != internalToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		var request aiclient.CurriculumGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode course request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		f.mu.Lock()
		f.lastCorrections = request.LearnerCorrections
		f.lastAdditional = request.AdditionalInstructions
		f.lastPrevious = request.PreviousVersionSummary
		fail := f.failCourse
		invalid := f.invalidCourse
		f.mu.Unlock()
		if fail {
			w.WriteHeader(http.StatusBadGateway)
			_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]string{"code": "provider_error", "message": "Provider failed."}})
			return
		}
		course := testCourse("Generated Go Course")
		if invalid {
			course.Modules = nil
		}
		_ = json.NewEncoder(w).Encode(domain.CourseGenerationResult{
			Course: course, Warnings: []string{}, Metadata: fakeMetadata(),
		})
	})
	mux.HandleFunc("/internal/v1/chat", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Internal-Token") != internalToken {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		var request aiclient.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode chat request: %v", err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		f.mu.Lock()
		f.lastChatMode = request.Mode
		f.lastChatContext = request.Context
		f.lastChatMessages = request.Messages
		f.mu.Unlock()
		_ = json.NewEncoder(w).Encode(aiclient.ChatResponse{
			Success: true,
			Data: &aiclient.ChatResponseData{
				Text: "A tutor reply from the engine.", Model: "frikhii-deterministic-v1",
				Provider: "mock", TutorMode: request.Mode,
				Usage: map[string]any{}, DurationMS: 3,
			},
		})
	})
	return mux
}

func fakeMetadata() domain.GenerationMetadata {
	return domain.GenerationMetadata{
		Provider: "mock", Model: "deterministic", GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		PromptVersion: "test-v1", DurationMS: 5,
	}
}

func testCourse(title string) domain.CourseBlueprint {
	return domain.CourseBlueprint{
		Title:                         title,
		ShortDescription:              "A practical course for a real learning goal.",
		Description:                   "Learn the core concepts and practice them.",
		LearningGoal:                  "Build a small production service.",
		TargetLearnerLevel:            "beginner",
		EstimatedDurationMinutes:      240,
		RecommendedWeeklyStudyMinutes: 180,
		Methodology:                   "Practice first, then review.",
		ExpectedOutcome:               "A tested service.",
		Objectives:                    []domain.Objective{{ID: "obj-1", Description: "Explain the execution model.", Competency: "go"}},
		TargetCompetencies:            []domain.Competency{{ID: "comp-1", Name: "Go", Description: "Build Go programs."}},
		Prerequisites:                 []domain.Prerequisite{},
		Modules: []domain.CourseModuleAI{{
			ID:                       "module-1",
			Sequence:                 1,
			Title:                    "Foundations",
			Description:              "The core execution model.",
			Objectives:               []domain.Objective{{ID: "obj-m1", Description: "Describe goroutines.", Competency: "go"}},
			Skills:                   []string{"writing Go"},
			EstimatedDurationMinutes: 240,
			Classes: []domain.ClassAI{{
				ID:                       "class-1",
				Sequence:                 1,
				Title:                    "Goroutines",
				Description:              "Start concurrent work.",
				Objectives:               []domain.Objective{{ID: "obj-c1", Description: "Coordinate goroutines.", Competency: "go"}},
				PrerequisiteClassIDs:     []string{},
				EstimatedDurationMinutes: 120,
				KeyConcepts:              []string{"goroutine"},
				KnowledgeCheck:           domain.KnowledgeCheckBlueprint{Description: "Check understanding.", QuestionCount: 2, Competencies: []string{"go"}},
				Exercise: domain.ExerciseBlueprint{
					Title: "Practice", Description: "Write a concurrent program.", Difficulty: "foundation",
					Competency: "go", Instructions: []string{"Write it."}, ExpectedDeliverable: "A program.",
					EvaluationCriteria: []string{"It runs."},
				},
				Lessons: []domain.LessonAI{{
					ID: "lesson-1", Sequence: 1, Title: "Starting goroutines",
					Description: "Observe concurrency.", EstimatedDurationMinutes: 45,
					Blueprint: domain.LessonBlueprint{
						Introduction: "An introduction.", Objectives: []string{"Start a goroutine."},
						ConceptOutline: []string{"Concept"}, Analogies: []string{"An analogy"},
						Demonstration: []string{"A demo"}, GuidedPractice: []string{"Guided practice"},
						IndependentPractice: []string{"Independent practice"}, KnowledgeCheck: []string{"A check"},
						Summary: "A summary.",
					},
				}},
			}},
		}},
		FinalProject: domain.FinalProject{
			Title: "Project", Description: "Build it.", Competencies: []string{"go"},
			Deliverable: "A service.", EvaluationCriteria: []string{"Works."},
		},
		FinalAssessment: domain.FinalAssessment{
			Title: "Assessment", Description: "Show it.", Format: "Review",
			Competencies: []string{"go"}, PassingCriteria: []string{"Meets criteria."},
		},
		Assumptions: []string{}, SuggestedSearchTopics: []string{"Go concurrency"},
	}
}

type testAPI struct {
	handler http.Handler
	ai      *fakeAI
}

func newTestAPI(t *testing.T) *testAPI {
	t.Helper()
	ai := &fakeAI{}
	aiServer := httptest.NewServer(ai.handler(t))
	t.Cleanup(aiServer.Close)
	cfg := config.Config{
		AppEnv:               "test",
		AuthDisabled:         true,
		CORSOrigins:          []string{"http://localhost:5173"},
		MaxRequestBytes:      524288,
		AITimeout:            10 * time.Second,
		AIGenerationTimeout:  10 * time.Second,
		GenerationStaleAfter: time.Minute,
	}
	client := aiclient.New(aiServer.URL, internalToken, 10*time.Second)
	server := New(cfg, store.NewMemory(), client, nil)
	return &testAPI{handler: server.Router(), ai: ai}
}

func (api *testAPI) request(t *testing.T, method, path, user string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(data)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if user != "" {
		req.Header.Set("X-Debug-User-ID", user)
	}
	recorder := httptest.NewRecorder()
	api.handler.ServeHTTP(recorder, req)
	return recorder
}

func decodeBody[T any](t *testing.T, recorder *httptest.ResponseRecorder) T {
	t.Helper()
	var value T
	if err := json.Unmarshal(recorder.Body.Bytes(), &value); err != nil {
		t.Fatalf("decode response %d %q: %v", recorder.Code, recorder.Body.String(), err)
	}
	return value
}

func goalPayload() map[string]any {
	return map[string]any{
		"title":                "Build production Go services",
		"goal_statement":       "I want to design and ship a production Go service.",
		"intended_outcome":     "I can build, test, deploy, and operate a Go API.",
		"motivation":           "My team is moving its backend to Go.",
		"additional_context":   "",
		"self_reported_level":  "basic",
		"current_knowledge":    map[string]any{"go": "basics"},
		"weekly_study_minutes": 360,
		"learning_language":    "en-US",
		"learning_preferences": map[string]any{"style": "hands-on"},
	}
}

func TestHTTPFullCourseLifecycle(t *testing.T) {
	api := newTestAPI(t)

	created := api.request(t, http.MethodPost, "/api/v1/learning-goals", apiTestUser, goalPayload())
	if created.Code != http.StatusCreated {
		t.Fatalf("create goal: %d %s", created.Code, created.Body.String())
	}
	goalBody := decodeBody[struct {
		LearningGoal domain.LearningGoal `json:"learning_goal"`
	}](t, created)
	goalID := goalBody.LearningGoal.ID
	if goalID == "" || goalBody.LearningGoal.Status != "intake" {
		t.Fatalf("unexpected goal: %#v", goalBody.LearningGoal)
	}

	diagnostic := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/diagnostic", apiTestUser, nil)
	if diagnostic.Code != http.StatusCreated {
		t.Fatalf("generate diagnostic: %d %s", diagnostic.Code, diagnostic.Body.String())
	}
	diagnosticBody := decodeBody[struct {
		Diagnostic domain.DiagnosticAttempt `json:"diagnostic"`
	}](t, diagnostic)
	if diagnosticBody.Diagnostic.Status != "ready" || len(diagnosticBody.Diagnostic.Questions) != 6 {
		t.Fatalf("unexpected diagnostic: %#v", diagnosticBody.Diagnostic)
	}
	for _, question := range diagnosticBody.Diagnostic.Questions {
		if question.Explanation != "" {
			t.Fatal("answer explanations must not be sent to the browser")
		}
	}
	answers := []map[string]string{}
	for _, question := range diagnosticBody.Diagnostic.Questions {
		answers = append(answers, map[string]string{"question_id": question.ID, "response": "A considered answer."})
	}
	submitted := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/diagnostic/submit", apiTestUser, map[string]any{
		"attempt_id": diagnosticBody.Diagnostic.ID,
		"answers":    answers,
	})
	if submitted.Code != http.StatusOK {
		t.Fatalf("submit diagnostic: %d %s", submitted.Code, submitted.Body.String())
	}
	evaluated := decodeBody[struct {
		Diagnostic domain.DiagnosticAttempt `json:"diagnostic"`
	}](t, submitted)
	if evaluated.Diagnostic.Status != "evaluated" || evaluated.Diagnostic.EstimatedLevel == nil {
		t.Fatalf("unexpected evaluation: %#v", evaluated.Diagnostic)
	}

	result := api.request(t, http.MethodGet, "/api/v1/learning-goals/"+goalID+"/diagnostic/result", apiTestUser, nil)
	if result.Code != http.StatusOK {
		t.Fatalf("diagnostic result: %d %s", result.Code, result.Body.String())
	}

	generated := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/generate", apiTestUser, map[string]any{})
	if generated.Code != http.StatusCreated {
		t.Fatalf("generate course: %d %s", generated.Code, generated.Body.String())
	}
	courseBody := decodeBody[struct {
		Course domain.CourseDetail `json:"course"`
	}](t, generated)
	courseID := courseBody.Course.ID
	if courseID == "" || courseBody.Course.Version == nil || courseBody.Course.Version.Status != "draft" {
		t.Fatalf("unexpected course: %#v", courseBody.Course)
	}
	if courseBody.Course.Counts.Classes != 1 || courseBody.Course.Counts.Lessons != 1 {
		t.Fatalf("unexpected counts: %#v", courseBody.Course.Counts)
	}
	version1ID := courseBody.Course.Version.ID

	edited := api.request(t, http.MethodPatch, "/api/v1/courses/"+courseID+"/draft", apiTestUser, map[string]any{
		"version_id": version1ID,
		"title":      "Reviewed Go Course",
	})
	if edited.Code != http.StatusOK {
		t.Fatalf("edit draft: %d %s", edited.Code, edited.Body.String())
	}
	editedBody := decodeBody[struct {
		Course domain.CourseDetail `json:"course"`
	}](t, edited)
	if editedBody.Course.Version.Title != "Reviewed Go Course" {
		t.Fatalf("draft title was not saved: %q", editedBody.Course.Version.Title)
	}

	regenerated := api.request(t, http.MethodPost, "/api/v1/courses/"+courseID+"/regenerate", apiTestUser, map[string]any{
		"instructions": "Make the examples more practical.",
	})
	if regenerated.Code != http.StatusCreated {
		t.Fatalf("regenerate: %d %s", regenerated.Code, regenerated.Body.String())
	}
	regeneratedBody := decodeBody[struct {
		Course domain.CourseDetail `json:"course"`
	}](t, regenerated)
	if regeneratedBody.Course.Version.VersionNumber != 2 || regeneratedBody.Course.ApprovedVersion != nil {
		t.Fatalf("unexpected regenerated course: %#v", regeneratedBody.Course)
	}
	if regeneratedBody.Course.Version.Status != "draft" || regeneratedBody.Course.CurrentVersionID == nil {
		t.Fatal("regeneration must create a new current draft")
	}
	version2ID := regeneratedBody.Course.Version.ID
	api.ai.mu.Lock()
	previous := api.ai.lastPrevious
	additional := api.ai.lastAdditional
	api.ai.mu.Unlock()
	if previous == "" || additional == "" {
		t.Fatalf("regeneration instructions were not forwarded: previous=%q additional=%q", previous, additional)
	}

	// A failed regeneration must leave the existing draft (and goal status) usable.
	api.ai.setFailure(true, false)
	failedRegeneration := api.request(t, http.MethodPost, "/api/v1/courses/"+courseID+"/regenerate", apiTestUser, map[string]any{
		"instructions": "Try a different structure.",
	})
	if failedRegeneration.Code != http.StatusBadGateway {
		t.Fatalf("expected a 502 from a failed regeneration, got %d %s", failedRegeneration.Code, failedRegeneration.Body.String())
	}
	goalAfterFailure := api.request(t, http.MethodGet, "/api/v1/learning-goals/"+goalID, apiTestUser, nil)
	goalAfterFailureBody := decodeBody[struct {
		LearningGoal domain.LearningGoal `json:"learning_goal"`
	}](t, goalAfterFailure)
	if goalAfterFailureBody.LearningGoal.Status != "course_draft" || goalAfterFailureBody.LearningGoal.LastError != nil {
		t.Fatalf("a failed regeneration must keep the existing draft: %#v", goalAfterFailureBody.LearningGoal)
	}
	api.ai.setFailure(false, false)

	approved := api.request(t, http.MethodPost, "/api/v1/courses/"+courseID+"/approve", apiTestUser, map[string]any{"version_id": version2ID})
	if approved.Code != http.StatusOK {
		t.Fatalf("approve: %d %s", approved.Code, approved.Body.String())
	}
	approvedBody := decodeBody[struct {
		Course domain.CourseDetail `json:"course"`
	}](t, approved)
	if approvedBody.Course.Status != "approved" || approvedBody.Course.ApprovedVersion == nil || approvedBody.Course.ApprovedVersion.ID != version2ID {
		t.Fatalf("unexpected approval: %#v", approvedBody.Course)
	}
	duplicate := api.request(t, http.MethodPost, "/api/v1/courses/"+courseID+"/approve", apiTestUser, map[string]any{"version_id": version2ID})
	if duplicate.Code != http.StatusOK {
		t.Fatalf("duplicate approval should be idempotent: %d %s", duplicate.Code, duplicate.Body.String())
	}

	list := api.request(t, http.MethodGet, "/api/v1/courses", apiTestUser, nil)
	if list.Code != http.StatusOK {
		t.Fatalf("list courses: %d %s", list.Code, list.Body.String())
	}
	listBody := decodeBody[struct {
		Courses []domain.CourseSummary `json:"courses"`
	}](t, list)
	if len(listBody.Courses) != 1 || listBody.Courses[0].Status != "approved" || listBody.Courses[0].HasDraft {
		t.Fatalf("unexpected course list: %#v", listBody.Courses)
	}

	other := api.request(t, http.MethodGet, "/api/v1/courses/"+courseID, apiOtherUser, nil)
	if other.Code != http.StatusNotFound {
		t.Fatalf("ownership boundary failed: %d %s", other.Code, other.Body.String())
	}
}

func TestHTTPValidationAndGenerationFailures(t *testing.T) {
	api := newTestAPI(t)

	unauthenticated := api.request(t, http.MethodGet, "/api/v1/courses", "", nil)
	if unauthenticated.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without a user, got %d", unauthenticated.Code)
	}
	invalidGoal := goalPayload()
	invalidGoal["title"] = "x"
	invalidGoalResponse := api.request(t, http.MethodPost, "/api/v1/learning-goals", apiTestUser, invalidGoal)
	if invalidGoalResponse.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected validation failure, got %d %s", invalidGoalResponse.Code, invalidGoalResponse.Body.String())
	}

	created := api.request(t, http.MethodPost, "/api/v1/learning-goals", apiTestUser, goalPayload())
	goalID := decodeBody[struct {
		LearningGoal domain.LearningGoal `json:"learning_goal"`
	}](t, created).LearningGoal.ID
	diagnostic := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/diagnostic", apiTestUser, nil)
	diagnosticBody := decodeBody[struct {
		Diagnostic domain.DiagnosticAttempt `json:"diagnostic"`
	}](t, diagnostic)
	answers := []map[string]string{}
	for _, question := range diagnosticBody.Diagnostic.Questions {
		answers = append(answers, map[string]string{"question_id": question.ID, "response": "An answer."})
	}
	submitted := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/diagnostic/submit", apiTestUser, map[string]any{
		"attempt_id": diagnosticBody.Diagnostic.ID, "answers": answers,
	})
	if submitted.Code != http.StatusOK {
		t.Fatalf("submit: %d %s", submitted.Code, submitted.Body.String())
	}

	api.ai.setFailure(true, false)
	failed := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/generate", apiTestUser, map[string]any{})
	if failed.Code != http.StatusBadGateway {
		t.Fatalf("expected a 502 from a provider failure, got %d %s", failed.Code, failed.Body.String())
	}
	goal := api.request(t, http.MethodGet, "/api/v1/learning-goals/"+goalID, apiTestUser, nil)
	goalBody := decodeBody[struct {
		LearningGoal domain.LearningGoal `json:"learning_goal"`
	}](t, goal)
	if goalBody.LearningGoal.Status != "failed" || goalBody.LearningGoal.LastError == nil {
		t.Fatalf("a failed generation must mark the goal retryable: %#v", goalBody.LearningGoal)
	}

	api.ai.setFailure(false, true)
	invalidContent := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/generate", apiTestUser, map[string]any{})
	if invalidContent.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected invalid AI content to be rejected, got %d %s", invalidContent.Code, invalidContent.Body.String())
	}

	api.ai.setFailure(false, false)
	retried := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/generate", apiTestUser, map[string]any{})
	if retried.Code != http.StatusCreated {
		t.Fatalf("retry after failure: %d %s", retried.Code, retried.Body.String())
	}
}

func TestHTTPDoesNotExposeAnswerKeys(t *testing.T) {
	api := newTestAPI(t)
	created := api.request(t, http.MethodPost, "/api/v1/learning-goals", apiTestUser, goalPayload())
	goalID := decodeBody[struct {
		LearningGoal domain.LearningGoal `json:"learning_goal"`
	}](t, created).LearningGoal.ID
	diagnostic := api.request(t, http.MethodPost, "/api/v1/learning-goals/"+goalID+"/diagnostic", apiTestUser, nil)
	body := diagnostic.Body.String()
	for _, forbidden := range []string{"expected_answer", "answer_keys", "rubric"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("diagnostic response leaked %q: %s", forbidden, body)
		}
	}
}

func TestHTTPHealthAndReadiness(t *testing.T) {
	api := newTestAPI(t)
	health := api.request(t, http.MethodGet, "/healthz", "", nil)
	if health.Code != http.StatusOK {
		t.Fatalf("health: %d", health.Code)
	}
	ready := api.request(t, http.MethodGet, "/readyz", "", nil)
	if ready.Code != http.StatusServiceUnavailable && ready.Code != http.StatusOK {
		t.Fatalf("unexpected readiness status: %d", ready.Code)
	}
	if !strings.Contains(ready.Body.String(), "auth_disabled") {
		t.Fatalf("readiness must report auth mode: %s", ready.Body.String())
	}
}

func TestHTTPCORSAndRequestID(t *testing.T) {
	api := newTestAPI(t)
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/courses", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	recorder := httptest.NewRecorder()
	api.handler.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("preflight: %d", recorder.Code)
	}
	if recorder.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatal("preflight did not return the allowed origin")
	}
	if recorder.Header().Get("Access-Control-Allow-Headers") == "" {
		t.Fatal("preflight did not return allowed headers")
	}

	req = httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("X-Request-ID", "test-request-1")
	recorder = httptest.NewRecorder()
	api.handler.ServeHTTP(recorder, req)
	if recorder.Header().Get("X-Request-ID") == "" {
		t.Fatal("request id was not returned")
	}
}

func TestTutorConversationFlow(t *testing.T) {
	api := newTestAPI(t)

	created := api.request(t, http.MethodPost, "/api/v1/conversations", apiTestUser, map[string]any{
		"title":      "Deep Dive - Go Foundations",
		"tutor_mode": "deep-dive",
	})
	if created.Code != http.StatusCreated {
		t.Fatalf("create conversation: status %d body %s", created.Code, created.Body.String())
	}
	conversation := decodeBody[struct {
		Conversation domain.Conversation `json:"conversation"`
	}](t, created).Conversation

	sent := api.request(t, http.MethodPost, "/api/v1/conversations/"+conversation.ID+"/messages", apiTestUser, map[string]any{
		"content": "What does this concept mean?",
		"context": map[string]any{"course_title": "Go Foundations", "lesson_title": "Goroutines"},
	})
	if sent.Code != http.StatusOK {
		t.Fatalf("send message: status %d body %s", sent.Code, sent.Body.String())
	}
	result := decodeBody[struct {
		AssistantMessage domain.Message `json:"assistant_message"`
	}](t, sent)
	if result.AssistantMessage.Content != "A tutor reply from the engine." {
		t.Errorf("assistant content = %q", result.AssistantMessage.Content)
	}

	api.ai.mu.Lock()
	mode := api.ai.lastChatMode
	chatContext := api.ai.lastChatContext
	messageCount := len(api.ai.lastChatMessages)
	api.ai.mu.Unlock()
	if mode != "deep_dive" {
		t.Errorf("AI mode = %q, want %q", mode, "deep_dive")
	}
	if chatContext == nil || chatContext.CourseTitle != "Go Foundations" || chatContext.LessonTitle != "Goroutines" {
		t.Errorf("AI context = %+v", chatContext)
	}
	if messageCount != 1 {
		t.Errorf("AI message count = %d, want 1", messageCount)
	}
}
