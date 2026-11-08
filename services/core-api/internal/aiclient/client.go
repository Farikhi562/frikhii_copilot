package aiclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/frikhii/copilot/core-api/internal/domain"
)

var (
	ErrTimeout       = errors.New("ai engine timeout")
	ErrUnavailable   = errors.New("ai engine unavailable")
	ErrInvalid       = errors.New("ai engine returned invalid content")
	ErrRateLimited   = errors.New("ai engine rate limited")
	ErrNotConfigured = errors.New("ai engine not configured")
)

type AIError struct {
	Kind    error
	Code    string
	Message string
}

func (e *AIError) Error() string { return e.Message }
func (e *AIError) Unwrap() error { return e.Kind }

type GoalContext struct {
	Title               string         `json:"title"`
	GoalStatement       string         `json:"goal_statement"`
	IntendedOutcome     string         `json:"intended_outcome"`
	Motivation          string         `json:"motivation"`
	AdditionalContext   string         `json:"additional_context"`
	SelfReportedLevel   string         `json:"self_reported_level"`
	CurrentKnowledge    map[string]any `json:"current_knowledge"`
	WeeklyStudyMinutes  int            `json:"weekly_study_minutes"`
	LearningLanguage    string         `json:"learning_language"`
	LearningPreferences map[string]any `json:"learning_preferences"`
	TargetDate          *string        `json:"target_date"`
}

type AIQuestion struct {
	ID          string          `json:"id"`
	Sequence    int             `json:"sequence"`
	Type        string          `json:"type"`
	Prompt      string          `json:"prompt"`
	Competency  string          `json:"competency"`
	Difficulty  string          `json:"difficulty"`
	Choices     []domain.Choice `json:"choices"`
	Explanation string          `json:"explanation"`
}

type TopicAnalysis struct {
	NormalizedTopic string                `json:"normalized_topic"`
	Summary         string                `json:"summary"`
	Prerequisites   []domain.Prerequisite `json:"prerequisites"`
	Competencies    []domain.Competency   `json:"competencies"`
	Complexity      string                `json:"complexity"`
	Assumptions     []string              `json:"assumptions"`
}

type DiagnosticQuestionSet struct {
	Analysis         TopicAnalysis `json:"analysis"`
	Questions        []AIQuestion  `json:"questions"`
	EstimatedMinutes int           `json:"estimated_minutes"`
	Warnings         []string      `json:"warnings"`
}

type DiagnosticGenerationResponse struct {
	QuestionSet DiagnosticQuestionSet     `json:"question_set"`
	AnswerKeys  []domain.AnswerKey        `json:"answer_keys"`
	Metadata    domain.GenerationMetadata `json:"metadata"`
}

type DiagnosticEvaluationResponse struct {
	Evaluation domain.DiagnosticEvaluation `json:"evaluation"`
	Metadata   domain.GenerationMetadata   `json:"metadata"`
}

type DiagnosticContext struct {
	EstimatedLevel   string                `json:"estimated_level"`
	Confidence       string                `json:"confidence"`
	Summary          string                `json:"summary"`
	Strengths        []domain.Strength     `json:"strengths"`
	Gaps             []domain.KnowledgeGap `json:"gaps"`
	RecommendedStart string                `json:"recommended_start"`
	Rationale        string                `json:"rationale"`
}

type DiagnosticGenerateRequest struct {
	LearningGoal  GoalContext `json:"learning_goal"`
	QuestionCount int         `json:"question_count"`
	RequestID     string      `json:"request_id,omitempty"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatContext struct {
	CourseID         string   `json:"course_id,omitempty"`
	CourseTitle      string   `json:"course_title,omitempty"`
	ModuleTitle      string   `json:"module_title,omitempty"`
	ClassTitle       string   `json:"class_title,omitempty"`
	LessonID         string   `json:"lesson_id,omitempty"`
	LessonTitle      string   `json:"lesson_title,omitempty"`
	LessonObjectives []string `json:"lesson_objectives,omitempty"`
	UserLevel        string   `json:"user_level,omitempty"`
}

type ChatRequest struct {
	Mode        string        `json:"mode"`
	Messages    []ChatMessage `json:"messages"`
	Context     *ChatContext  `json:"context,omitempty"`
	Temperature *float64      `json:"temperature,omitempty"`
	MaxTokens   *int          `json:"max_tokens,omitempty"`
}

type ChatResponseData struct {
	Text         string         `json:"text"`
	Model        string         `json:"model"`
	Provider     string         `json:"provider"`
	TutorMode    string         `json:"tutor_mode"`
	Usage        map[string]any `json:"usage"`
	FinishReason *string        `json:"finish_reason,omitempty"`
	FallbackUsed bool           `json:"fallback_used"`
	DurationMS   int            `json:"duration_ms"`
}

type ChatResponse struct {
	Success bool              `json:"success"`
	Data    *ChatResponseData `json:"data,omitempty"`
	Error   *string           `json:"error,omitempty"`
}

type DiagnosticEvaluateRequest struct {
	LearningGoal GoalContext               `json:"learning_goal"`
	Questions    []AIQuestion              `json:"questions"`
	AnswerKeys   []domain.AnswerKey        `json:"answer_keys"`
	Answers      []domain.DiagnosticAnswer `json:"answers"`
	PriorLevel   string                    `json:"prior_level,omitempty"`
	RequestID    string                    `json:"request_id,omitempty"`
}

type CurriculumGenerateRequest struct {
	LearningGoal           GoalContext       `json:"learning_goal"`
	Diagnostic             DiagnosticContext `json:"diagnostic"`
	LearnerCorrections     string            `json:"learner_corrections"`
	AdditionalInstructions string            `json:"additional_instructions"`
	PreviousVersionSummary string            `json:"previous_version_summary"`
	RequestID              string            `json:"request_id,omitempty"`
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func New(baseURL, token string, timeout time.Duration) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		http:    &http.Client{Timeout: timeout},
	}
}

func (c *Client) Configured() bool {
	return c != nil && c.baseURL != "" && c.token != ""
}

func (c *Client) Health(ctx context.Context) bool {
	if c == nil || c.baseURL == "" {
		return false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return false
	}
	response, err := c.http.Do(req)
	if err != nil {
		return false
	}
	defer response.Body.Close()
	return response.StatusCode == http.StatusOK
}

// MockProvider reports whether the AI Engine is running the deterministic mock
// provider. The second result is false when health could not be read.
func (c *Client) MockProvider(ctx context.Context) (bool, bool) {
	if c == nil || c.baseURL == "" {
		return false, false
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return false, false
	}
	response, err := c.http.Do(req)
	if err != nil {
		return false, false
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return false, false
	}
	var body struct {
		MockProvider bool `json:"mock_provider"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 32_768)).Decode(&body); err != nil {
		return false, false
	}
	return body.MockProvider, true
}

func (c *Client) GenerateDiagnostic(ctx context.Context, request DiagnosticGenerateRequest) (*DiagnosticGenerationResponse, error) {
	var result DiagnosticGenerationResponse
	if err := c.post(ctx, "/internal/v1/diagnostic/generate", request, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) EvaluateDiagnostic(ctx context.Context, request DiagnosticEvaluateRequest) (*DiagnosticEvaluationResponse, error) {
	var result DiagnosticEvaluationResponse
	if err := c.post(ctx, "/internal/v1/diagnostic/evaluate", request, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) GenerateCourse(ctx context.Context, request CurriculumGenerateRequest) (*domain.CourseGenerationResult, error) {
	var result domain.CourseGenerationResult
	if err := c.post(ctx, "/internal/v1/course/generate", request, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	var result ChatResponse
	if err := c.post(ctx, "/internal/v1/chat", req, &result); err != nil {
		return nil, err
	}
	if !result.Success && result.Error != nil {
		return nil, &AIError{Kind: ErrInvalid, Code: "ai_tutor_error", Message: *result.Error}
	}
	return &result, nil
}

// ── Learning Engine ──────────────────────────────────────────────────────────

// LessonGenerateRequest sent to the AI Engine to expand a blueprint.
type LessonGenerateRequest struct {
	LessonID         string         `json:"lesson_id"`
	Title            string         `json:"title"`
	Description      string         `json:"description"`
	Blueprint        map[string]any `json:"blueprint"`
	CourseTitle      string         `json:"course_title"`
	ClassTitle       string         `json:"class_title"`
	LearningLanguage string         `json:"learning_language"`
	LearnerLevel     string         `json:"learner_level"`
	RequestID        string         `json:"request_id,omitempty"`
}

type LessonSection struct {
	Type  string   `json:"type"`
	Title string   `json:"title"`
	Body  string   `json:"body"`
	Items []string `json:"items"`
}

type AuthoredLesson struct {
	LessonID                 string          `json:"lesson_id"`
	Title                    string          `json:"title"`
	EstimatedDurationMinutes int             `json:"estimated_duration_minutes"`
	Sections                 []LessonSection `json:"sections"`
	KeyTakeaways             []string        `json:"key_takeaways"`
	FurtherSearchTopics      []string        `json:"further_search_topics"`
}

type LessonGenerateResponse struct {
	Lesson   AuthoredLesson            `json:"lesson"`
	Metadata domain.GenerationMetadata `json:"metadata"`
}

func (c *Client) GenerateLesson(ctx context.Context, req LessonGenerateRequest) (*LessonGenerateResponse, error) {
	var result LessonGenerateResponse
	if err := c.post(ctx, "/internal/v1/lesson/generate", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// QuizGenerateRequest asks the AI Engine to produce quiz questions for a class.
type QuizGenerateRequest struct {
	ClassID                  string   `json:"class_id"`
	ClassTitle               string   `json:"class_title"`
	ClassDescription         string   `json:"class_description"`
	Competencies             []string `json:"competencies"`
	KnowledgeCheckDescription string  `json:"knowledge_check_description"`
	QuestionCount            int      `json:"question_count"`
	CourseTitle              string   `json:"course_title"`
	LearningLanguage         string   `json:"learning_language"`
	LearnerLevel             string   `json:"learner_level"`
	RequestID                string   `json:"request_id,omitempty"`
}

type QuizGenerateResponse struct {
	Questions    []domain.QuizQuestion    `json:"questions"`
	AnswerKeys   []domain.QuizAnswerKey   `json:"answer_keys"`
	PassingScore int                      `json:"passing_score"`
	Metadata     domain.GenerationMetadata `json:"metadata"`
}

func (c *Client) GenerateQuiz(ctx context.Context, req QuizGenerateRequest) (*QuizGenerateResponse, error) {
	var result QuizGenerateResponse
	if err := c.post(ctx, "/internal/v1/quiz/generate", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// QuizEvaluateRequest sends answers to the AI Engine for grading.
type QuizEvaluateRequest struct {
	ClassID      string                   `json:"class_id"`
	ClassTitle   string                   `json:"class_title"`
	Questions    []domain.QuizQuestion    `json:"questions"`
	AnswerKeys   []domain.QuizAnswerKey   `json:"answer_keys"`
	Answers      []domain.QuizAnswer      `json:"answers"`
	PassingScore int                      `json:"passing_score"`
	RequestID    string                   `json:"request_id,omitempty"`
}

type QuizEvaluateResponse struct {
	Evaluation domain.QuizEvaluation     `json:"evaluation"`
	Metadata   domain.GenerationMetadata `json:"metadata"`
}

func (c *Client) EvaluateQuiz(ctx context.Context, req QuizEvaluateRequest) (*QuizEvaluateResponse, error) {
	var result QuizEvaluateResponse
	if err := c.post(ctx, "/internal/v1/quiz/evaluate", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ExerciseGenerateRequest expands a blueprint into a full exercise.
type ExerciseGenerateRequest struct {
	ClassID             string `json:"class_id"`
	ClassTitle          string `json:"class_title"`
	ExerciseTitle       string `json:"exercise_title"`
	ExerciseDescription string `json:"exercise_description"`
	Difficulty          string `json:"difficulty"`
	Competency          string `json:"competency"`
	CourseTitle         string `json:"course_title"`
	LearningLanguage    string `json:"learning_language"`
	LearnerLevel        string `json:"learner_level"`
	RequestID           string `json:"request_id,omitempty"`
}

type ExerciseStep struct {
	StepNumber  int    `json:"step_number"`
	Instruction string `json:"instruction"`
	Hint        string `json:"hint"`
}

type AuthoredExercise struct {
	Title               string         `json:"title"`
	Context             string         `json:"context"`
	Steps               []ExerciseStep `json:"steps"`
	ExpectedDeliverable string         `json:"expected_deliverable"`
	EvaluationCriteria  []string       `json:"evaluation_criteria"`
	FurtherSearchTopics []string       `json:"further_search_topics"`
}

type ExerciseGenerateResponse struct {
	Exercise AuthoredExercise           `json:"exercise"`
	Metadata domain.GenerationMetadata  `json:"metadata"`
}

func (c *Client) GenerateExercise(ctx context.Context, req ExerciseGenerateRequest) (*ExerciseGenerateResponse, error) {
	var result ExerciseGenerateResponse
	if err := c.post(ctx, "/internal/v1/exercise/generate", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RemedialGenerateRequest asks the AI Engine for a remedial study plan.
type RemedialGenerateRequest struct {
	ClassID             string                `json:"class_id"`
	ClassTitle          string                `json:"class_title"`
	CourseTitle         string                `json:"course_title"`
	QuizScore           int                   `json:"quiz_score"`
	PassingScore        int                   `json:"passing_score"`
	Gaps                []domain.KnowledgeGap `json:"gaps"`
	Strengths           []string              `json:"strengths"`
	LearningLanguage    string                `json:"learning_language"`
	LearnerLevel        string                `json:"learner_level"`
	WeeklyStudyMinutes  int                   `json:"weekly_study_minutes"`
	RequestID           string                `json:"request_id,omitempty"`
}

type RemedialActivity struct {
	Sequence         int    `json:"sequence"`
	Title            string `json:"title"`
	Description      string `json:"description"`
	ActivityType     string `json:"activity_type"`
	EstimatedMinutes int    `json:"estimated_minutes"`
	TargetGap        string `json:"target_gap"`
}

type RemedialPlan struct {
	GapSummary              string             `json:"gap_summary"`
	EstimatedTotalMinutes   int                `json:"estimated_total_minutes"`
	Activities              []RemedialActivity `json:"activities"`
	KeyConceptsToRevisit    []string           `json:"key_concepts_to_revisit"`
	FurtherSearchTopics     []string           `json:"further_search_topics"`
	Encouragement           string             `json:"encouragement"`
}

type RemedialGenerateResponse struct {
	Plan     RemedialPlan               `json:"plan"`
	Metadata domain.GenerationMetadata  `json:"metadata"`
}

func (c *Client) GenerateRemedial(ctx context.Context, req RemedialGenerateRequest) (*RemedialGenerateResponse, error) {
	var result RemedialGenerateResponse
	if err := c.post(ctx, "/internal/v1/remedial/generate", req, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *Client) post(ctx context.Context, path string, body any, target any) error {
	if !c.Configured() {
		return &AIError{Kind: ErrNotConfigured, Code: "ai_not_configured", Message: "The AI engine is not configured."}
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return &AIError{Kind: ErrUnavailable, Code: "ai_request_invalid", Message: "The AI request could not be encoded."}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(payload))
	if err != nil {
		return &AIError{Kind: ErrUnavailable, Code: "ai_request_invalid", Message: "The AI request could not be created."}
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("X-Internal-Token", c.token)
	if requestID, ok := ctx.Value(requestIDKey{}).(string); ok && requestID != "" {
		request.Header.Set("X-Request-ID", requestID)
	}

	response, err := c.http.Do(request)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
			return &AIError{Kind: ErrTimeout, Code: "ai_timeout", Message: "Curriculum generation timed out."}
		}
		return &AIError{Kind: ErrUnavailable, Code: "ai_unavailable", Message: "The AI engine could not be reached."}
	}
	defer response.Body.Close()
	limited := io.LimitReader(response.Body, 2_000_000)
	raw, _ := io.ReadAll(limited)

	if response.StatusCode >= 200 && response.StatusCode < 300 {
		if err := json.Unmarshal(raw, target); err != nil {
			return &AIError{Kind: ErrInvalid, Code: "ai_invalid_response", Message: "The AI engine returned an unreadable response."}
		}
		return nil
	}

	var errorBody struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(raw, &errorBody)
	kind := ErrUnavailable
	switch response.StatusCode {
	case http.StatusGatewayTimeout:
		kind = ErrTimeout
	case http.StatusTooManyRequests:
		kind = ErrRateLimited
	case http.StatusUnprocessableEntity:
		kind = ErrInvalid
	}
	message := errorBody.Error.Message
	if message == "" {
		message = fmt.Sprintf("The AI engine returned HTTP %d.", response.StatusCode)
	}
	return &AIError{Kind: kind, Code: errorBody.Error.Code, Message: message}
}

type requestIDKey struct{}

func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, requestID)
}
