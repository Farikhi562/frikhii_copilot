package domain

import "time"

// QuizQuestion is the learner-facing shape of an assessment question. The expected
// answer never leaves the server; it lives in a separate answer-key record.
type QuizQuestion struct {
	ID          string   `json:"id"`
	Sequence    int      `json:"sequence"`
	Type        string   `json:"type"`
	Prompt      string   `json:"prompt"`
	Competency  string   `json:"competency"`
	Difficulty  string   `json:"difficulty"`
	Choices     []Choice `json:"choices"`
	Explanation string   `json:"explanation,omitempty"`
}

type QuizAnswerKey struct {
	QuestionID     string            `json:"question_id"`
	ExpectedAnswer string            `json:"expected_answer"`
	Rubric         []RubricCriterion `json:"rubric"`
}

type QuizAnswer struct {
	QuestionID string `json:"question_id"`
	Response   string `json:"response"`
	Score      *int   `json:"score,omitempty"`
	Feedback   string `json:"feedback,omitempty"`
}

type QuizQuestionScore struct {
	QuestionID string `json:"question_id"`
	Score      int    `json:"score"`
	Feedback   string `json:"feedback"`
}

type QuizAttempt struct {
	ID             string              `json:"id"`
	CourseID       string              `json:"course_id"`
	ClassID        string              `json:"class_id"`
	Status         string              `json:"status"`
	AttemptNumber  int                 `json:"attempt_number"`
	PassingScore   int                 `json:"passing_score"`
	Score          *int                `json:"score,omitempty"`
	Passed         *bool               `json:"passed,omitempty"`
	Summary        *string             `json:"summary,omitempty"`
	Strengths      []string            `json:"strengths"`
	Gaps           []KnowledgeGap      `json:"gaps"`
	QuestionScores []QuizQuestionScore `json:"question_scores"`
	Questions      []QuizQuestion      `json:"questions"`
	Answers        []QuizAnswer        `json:"answers"`
	SubmittedAt    *time.Time          `json:"submitted_at,omitempty"`
	EvaluatedAt    *time.Time          `json:"evaluated_at,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
}

type QuizEvaluation struct {
	Score          int                 `json:"score"`
	Passed         bool                `json:"passed"`
	Summary        string              `json:"summary"`
	Strengths      []string            `json:"strengths"`
	Gaps           []KnowledgeGap      `json:"gaps"`
	QuestionScores []QuizQuestionScore `json:"question_scores"`
}

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

const (
	RoadmapLessonLocked    = "locked"
	RoadmapLessonAvailable = "available"
	RoadmapLessonCompleted = "completed"

	RoadmapClassLocked      = "locked"
	RoadmapClassAvailable   = "available"
	RoadmapClassInProgress  = "in_progress"
	RoadmapClassNeedsReview = "needs_review"
	RoadmapClassCompleted   = "completed"
)

type RoadmapLesson struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Sequence    int    `json:"sequence"`
	Duration    int    `json:"estimated_duration_minutes"`
	Status      string `json:"status"`
}

type RoadmapClass struct {
	ID               string          `json:"id"`
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	Sequence         int             `json:"sequence"`
	Duration         int             `json:"estimated_duration_minutes"`
	Status           string          `json:"status"`
	Unlocked         bool            `json:"unlocked"`
	TotalLessons     int             `json:"total_lessons"`
	CompletedLessons int             `json:"completed_lessons"`
	QuizStatus       string          `json:"quiz_status"`
	QuizScore        *int            `json:"quiz_score,omitempty"`
	QuizAttemptID    *string         `json:"quiz_attempt_id,omitempty"`
	PassingScore     int             `json:"passing_score"`
	Lessons          []RoadmapLesson `json:"lessons"`
}

type RoadmapModule struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Sequence    int            `json:"sequence"`
	Classes     []RoadmapClass `json:"classes"`
}

type Roadmap struct {
	CourseID         string          `json:"course_id"`
	Title            string          `json:"title"`
	ShortDescription string          `json:"short_description"`
	Approved         bool            `json:"approved"`
	Modules          []RoadmapModule `json:"modules"`
	TotalLessons     int             `json:"total_lessons"`
	CompletedLessons int             `json:"completed_lessons"`
	TotalClasses     int             `json:"total_classes"`
	CompletedClasses int             `json:"completed_classes"`
	ProgressPercent  int             `json:"progress_percent"`
	NextLessonID     *string         `json:"next_lesson_id,omitempty"`
	NextClassID      *string         `json:"next_class_id,omitempty"`
}
