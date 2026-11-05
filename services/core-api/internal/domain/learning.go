package domain

import "time"

type LearningGoal struct {
	ID                  string         `json:"id"`
	UserID              string         `json:"-"`
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
	Status              string         `json:"status"`
	LastError           *string        `json:"last_error,omitempty"`
	CourseID            *string        `json:"course_id,omitempty"`
	CourseStatus        *string        `json:"course_status,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
}

type CreateLearningGoalInput struct {
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

type Choice struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

type DiagnosticQuestion struct {
	ID          string   `json:"id"`
	Sequence    int      `json:"sequence"`
	Type        string   `json:"type"`
	Prompt      string   `json:"prompt"`
	Competency  string   `json:"competency"`
	Difficulty  string   `json:"difficulty"`
	Choices     []Choice `json:"choices"`
	Explanation string   `json:"-"`
}

type RubricCriterion struct {
	Criterion   string  `json:"criterion"`
	Description string  `json:"description"`
	Weight      float64 `json:"weight"`
}

type AnswerKey struct {
	QuestionID     string            `json:"question_id"`
	ExpectedAnswer string            `json:"expected_answer"`
	Rubric         []RubricCriterion `json:"rubric"`
}

type DiagnosticAnswer struct {
	QuestionID string `json:"question_id"`
	Response   string `json:"response"`
	Score      *int   `json:"score,omitempty"`
	Feedback   string `json:"feedback,omitempty"`
}

type Strength struct {
	Competency string `json:"competency"`
	Evidence   string `json:"evidence"`
}

type KnowledgeGap struct {
	Competency     string `json:"competency"`
	Description    string `json:"description"`
	Severity       string `json:"severity"`
	Recommendation string `json:"recommendation"`
}

type QuestionScore struct {
	QuestionID string `json:"question_id"`
	Score      int    `json:"score"`
	Feedback   string `json:"feedback"`
}

type DiagnosticEvaluation struct {
	EstimatedLevel   string          `json:"estimated_level"`
	Confidence       string          `json:"confidence"`
	Summary          string          `json:"summary"`
	Strengths        []Strength      `json:"strengths"`
	Gaps             []KnowledgeGap  `json:"gaps"`
	Misconceptions   []string        `json:"misconceptions"`
	RecommendedStart string          `json:"recommended_start"`
	Rationale        string          `json:"rationale"`
	QuestionScores   []QuestionScore `json:"question_scores"`
	CanSkip          []string        `json:"can_skip"`
}

type DiagnosticAttempt struct {
	ID               string               `json:"id"`
	LearningGoalID   string               `json:"learning_goal_id"`
	Status           string               `json:"status"`
	AttemptNumber    int                  `json:"attempt_number"`
	EstimatedLevel   *string              `json:"estimated_level,omitempty"`
	Confidence       *string              `json:"confidence,omitempty"`
	Summary          *string              `json:"evaluation_summary,omitempty"`
	Strengths        []Strength           `json:"strengths"`
	KnowledgeGaps    []KnowledgeGap       `json:"knowledge_gaps"`
	Misconceptions   []string             `json:"misconceptions"`
	RecommendedStart *string              `json:"recommended_start,omitempty"`
	Rationale        *string              `json:"rationale,omitempty"`
	QuestionScores   []QuestionScore      `json:"question_scores"`
	CanSkip          []string             `json:"can_skip"`
	Questions        []DiagnosticQuestion `json:"questions"`
	Answers          []DiagnosticAnswer   `json:"answers"`
	SubmittedAt      *time.Time           `json:"submitted_at,omitempty"`
	EvaluatedAt      *time.Time           `json:"evaluated_at,omitempty"`
	CreatedAt        time.Time            `json:"created_at"`
}

type SubmitDiagnosticInput struct {
	AttemptID string `json:"attempt_id"`
	Answers   []struct {
		QuestionID string `json:"question_id"`
		Response   string `json:"response"`
	} `json:"answers"`
}

type GenerateCourseInput struct {
	LearnerCorrections string `json:"learner_corrections"`
	RequestID          string `json:"request_id"`
}

type RegenerateCourseInput struct {
	Instructions string `json:"instructions"`
	RequestID    string `json:"request_id"`
}

type UpdateDraftInput struct {
	VersionID        string       `json:"version_id"`
	Title            *string      `json:"title,omitempty"`
	Description      *string      `json:"description,omitempty"`
	ShortDescription *string      `json:"short_description,omitempty"`
	Modules          []ModuleEdit `json:"modules,omitempty"`
	Classes          []ClassEdit  `json:"classes,omitempty"`
}

type ModuleEdit struct {
	ID          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

type ClassEdit struct {
	ID          string  `json:"id"`
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

type ApproveCourseInput struct {
	VersionID string `json:"version_id"`
}
