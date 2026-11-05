package store

import (
	"context"
	"errors"
	"time"

	"github.com/frikhii/copilot/core-api/internal/domain"
)

var (
	ErrNotFound             = errors.New("not found")
	ErrConflict             = errors.New("conflict")
	ErrInvalidState         = errors.New("invalid state")
	ErrGenerationInProgress = errors.New("generation already in progress")
	ErrUnavailable          = errors.New("store unavailable")
)

type Question struct {
	SourceID    string
	Sequence    int
	Type        string
	Prompt      string
	Competency  string
	Difficulty  string
	Choices     []domain.Choice
	Explanation string
}

type Store interface {
	Ping(ctx context.Context) error

	CreateLearningGoal(ctx context.Context, userID string, input domain.CreateLearningGoalInput) (*domain.LearningGoal, error)
	ListLearningGoals(ctx context.Context, userID string) ([]domain.LearningGoal, error)
	GetLearningGoal(ctx context.Context, userID, goalID string) (*domain.LearningGoal, error)
	BeginGeneration(ctx context.Context, userID, goalID string, staleAfter time.Duration) (*domain.LearningGoal, bool, error)
	SetGoalStatus(ctx context.Context, userID, goalID, status string, lastError *string) error

	CreateDiagnosticAttempt(ctx context.Context, userID, goalID string, questions []Question, keys []domain.AnswerKey) (*domain.DiagnosticAttempt, error)
	GetLatestDiagnostic(ctx context.Context, userID, goalID string) (*domain.DiagnosticAttempt, error)
	GetDiagnosticForEvaluation(ctx context.Context, userID, goalID, attemptID string) (*domain.DiagnosticAttempt, []domain.AnswerKey, error)
	SubmitDiagnosticAnswers(ctx context.Context, userID, goalID, attemptID string, answers []domain.DiagnosticAnswer) (*domain.DiagnosticAttempt, error)
	SaveDiagnosticEvaluation(ctx context.Context, userID, goalID, attemptID string, evaluation domain.DiagnosticEvaluation, metadata map[string]any) (*domain.DiagnosticAttempt, error)

	CreateCourseVersion(ctx context.Context, userID, goalID string, blueprint domain.CourseBlueprint, warnings []string, metadata domain.GenerationMetadata) (*domain.CourseDetail, error)
	GetCourse(ctx context.Context, userID, courseID string) (*domain.CourseDetail, error)
	ListCourses(ctx context.Context, userID string) ([]domain.CourseSummary, error)
	UpdateDraft(ctx context.Context, userID, courseID string, patch domain.UpdateDraftInput) (*domain.CourseDetail, error)
	ApproveCourse(ctx context.Context, userID, courseID, versionID string) (*domain.CourseDetail, error)

	CreateConversation(ctx context.Context, userID string, input domain.CreateConversationInput) (*domain.Conversation, error)
	ListConversations(ctx context.Context, userID string) ([]domain.Conversation, error)
	GetConversation(ctx context.Context, userID, conversationID string) (*domain.ConversationDetail, error)
	UpdateConversation(ctx context.Context, userID, conversationID string, input domain.UpdateConversationInput) (*domain.Conversation, error)
	DeleteConversation(ctx context.Context, userID, conversationID string) error
	AddMessage(ctx context.Context, userID, conversationID string, role, content, model string, tokenUsage, metadata map[string]any) (*domain.Message, error)

	CompleteLesson(ctx context.Context, userID, courseID, lessonID string) error
	GetCompletedLessons(ctx context.Context, userID, courseID string) ([]string, error)
	GetDashboard(ctx context.Context, userID string) (*domain.DashboardData, error)
	GetProgress(ctx context.Context, userID string) (*domain.ProgressData, error)
}
