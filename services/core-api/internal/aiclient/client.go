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
