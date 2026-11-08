// Package intelligence implements Phase 04: deterministic learner modelling.
//
// Authority rules
//   - Mastery, status, gaps, review dates and recommendations are computed here from
//     validated learning events. The LLM never writes them.
//   - AI output is limited to optional narrative insights, which are validated against
//     real event ids before storage (see ValidateAIInsights).
package intelligence

import (
	"errors"
	"time"
)

var (
	ErrNotFound   = errors.New("not found")
	ErrInvalid    = errors.New("invalid input")
	ErrUnknownCmp = errors.New("competency is not part of this course")
)

const (
	StatusNotStarted = "not_started"
	StatusLearning   = "learning"
	StatusDeveloping = "developing"
	StatusProficient = "proficient"
	StatusMastered   = "mastered"
)

var EventTypes = map[string]float64{
	// Weight each event type carries as mastery evidence. explanation_feedback is
	// stored but carries no mastery weight; lesson_completed is weak evidence.
	"assessment_result":     1.0,
	"retention_check":       1.0,
	"exercise_submitted":    0.9,
	"remediation_completed": 0.9,
	"lesson_completed":      0.4,
	"explanation_feedback":  0,
}

var difficultyWeight = map[string]float64{"easy": 0.8, "medium": 1.0, "hard": 1.2}

// Event is one validated piece of learning evidence. Score is 0..1.
type Event struct {
	ID             string    `json:"id"`
	CourseID       string    `json:"course_id"`
	Competency     string    `json:"competency"`
	Type           string    `json:"event_type"`
	Score          float64   `json:"score"`
	Difficulty     string    `json:"difficulty"`
	MistakeTags    []string  `json:"mistake_tags"`
	SourceRef      string    `json:"source_ref"`
	IdempotencyKey string    `json:"idempotency_key"`
	OccurredAt     time.Time `json:"occurred_at"`
}

// Record is the derived current state of one competency.
type Record struct {
	Competency         string          `json:"competency"`
	Status             string          `json:"status"`
	Mastery            float64         `json:"mastery"`
	PeakMastery        float64         `json:"peak_mastery"`
	Confidence         float64         `json:"confidence"`
	Attempts           int             `json:"attempts"`
	CorrectAttempts    int             `json:"correct_attempts"`
	CommonMistakes     []MistakeCount  `json:"common_mistakes"`
	Regression         bool            `json:"regression"`
	LastDemonstratedAt *time.Time      `json:"last_demonstrated_at"`
	LastEventAt        *time.Time      `json:"last_event_at"`
	AccuracyHistory    []AccuracyPoint `json:"accuracy_history"`
}

type MistakeCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

type AccuracyPoint struct {
	At      time.Time `json:"at"`
	Score   float64   `json:"score"`
	Mastery float64   `json:"mastery"`
}

// EvidenceRow records how one event moved one competency (audit trail).
type EvidenceRow struct {
	EventID       string  `json:"event_id"`
	Competency    string  `json:"competency"`
	MasteryBefore float64 `json:"mastery_before"`
	MasteryAfter  float64 `json:"mastery_after"`
	StatusAfter   string  `json:"status_after"`
}

type Gap struct {
	ID               string     `json:"id"`
	Competency       string     `json:"competency"`
	RelatedObjective string     `json:"related_objective"`
	Severity         string     `json:"severity"`
	Confidence       float64    `json:"confidence"`
	Cause            string     `json:"cause"` // current_lesson | prerequisite | retention
	Prerequisites    []string   `json:"prerequisites"`
	Unverified       []string   `json:"unverified_prerequisites"`
	EvidenceEventIDs []string   `json:"evidence_event_ids"`
	EvidenceSummary  string     `json:"evidence_summary"`
	Recommendation   string     `json:"recommendation"`
	Status           string     `json:"status"` // open | improving | resolved
	OpenedAt         time.Time  `json:"opened_at"`
	LastEvidenceAt   time.Time  `json:"last_evidence_at"`
	ResolvedAt       *time.Time `json:"resolved_at"`
}

type Recommendation struct {
	Kind       string `json:"kind"`
	Competency string `json:"competency"`
	Title      string `json:"title"`
	Reason     string `json:"reason"`
	Priority   int    `json:"priority"`
}

type ReviewItem struct {
	Competency   string    `json:"competency"`
	DueAt        time.Time `json:"due_at"`
	IntervalDays int       `json:"interval_days"`
	Repetitions  int       `json:"repetitions"`
}

type Insight struct {
	ID               string    `json:"id"`
	Kind             string    `json:"kind"` // strength|weakness|pattern|misconception|strategy
	Statement        string    `json:"statement"`
	Rationale        string    `json:"rationale"`
	EvidenceEventIDs []string  `json:"evidence_event_ids"`
	Confidence       string    `json:"confidence"`
	Source           string    `json:"source"` // rules|ai
	Status           string    `json:"status"` // active|corrected|dismissed
	UserNote         string    `json:"user_note"`
	CreatedAt        time.Time `json:"created_at"`
}

type Preferences struct {
	ExplanationStyle  string `json:"explanation_style"`
	ExampleStyle      string `json:"example_style"`
	Pace              string `json:"pace"`
	PreferredLanguage string `json:"preferred_language"`
	DailyStudyMinutes *int   `json:"daily_study_minutes"`
	ShortTermTarget   string `json:"short_term_target"`
	LongTermTarget    string `json:"long_term_target"`
}

func DefaultPreferences() Preferences {
	return Preferences{ExplanationStyle: "balanced", ExampleStyle: "mixed", Pace: "steady", PreferredLanguage: "en-US"}
}

// CourseInfo is the slice of course structure the engine needs.
type CourseInfo struct {
	CourseID      string
	Competencies  []string            // in course order
	Prerequisites map[string][]string // competency -> prerequisite competency names
}

// State is everything derived for one user+course. It is rebuildable from events.
type State struct {
	Records         map[string]Record
	Gaps            []Gap
	Reviews         []ReviewItem
	Recommendations []Recommendation
	RuleInsights    []Insight
}
