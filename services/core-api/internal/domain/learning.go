package domain

import (
	"encoding/json"
	"time"
)

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

type LessonWithContents struct {
	ID                       string          `json:"id"`
	SourceID                 string          `json:"source_id"`
	ClassID                  string          `json:"class_id"`
	Sequence                 int             `json:"sequence"`
	Title                    string          `json:"title"`
	Description              string          `json:"description"`
	EstimatedDurationMinutes int             `json:"estimated_duration_minutes"`
	Contents                 []LessonContent `json:"contents"`
}

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

type ExerciseWithAuthored struct {
	ID              string          `json:"id"`
	ClassID         string          `json:"class_id"`
	Title           string          `json:"title"`
	Description     string          `json:"description"`
	Difficulty      string          `json:"difficulty"`
	Competency      string          `json:"competency"`
	Instructions    []string        `json:"instructions"`
	AuthoredContent json.RawMessage `json:"authored_content,omitempty"`
}

type ExerciseSubmission struct {
	ID            string     `json:"id"`
	ExerciseID    string     `json:"exercise_id"`
	CourseID      string     `json:"course_id"`
	UserID        string     `json:"user_id"`
	AttemptNumber int        `json:"attempt_number"`
	Response      string     `json:"response"`
	Score         *int       `json:"score,omitempty"`
	Feedback      *string    `json:"feedback,omitempty"`
	Status        string     `json:"status"`
	SubmittedAt   time.Time  `json:"submitted_at"`
	EvaluatedAt   *time.Time `json:"evaluated_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// ---------------------------------------------------------------------------
// Remedial plan
// ---------------------------------------------------------------------------

type RemedialPlanRecord struct {
	ID            string          `json:"id"`
	CourseID      string          `json:"course_id"`
	ClassID       string          `json:"class_id"`
	QuizAttemptID *string         `json:"quiz_attempt_id,omitempty"`
	UserID        string          `json:"user_id"`
	Status        string          `json:"status"`
	GapSummary    string          `json:"gap_summary"`
	Plan          json.RawMessage `json:"plan"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}
