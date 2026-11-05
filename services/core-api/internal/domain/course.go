package domain

import (
	"encoding/json"
	"time"
)

type Objective struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Competency  string `json:"competency"`
}

type Competency struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Prerequisite struct {
	Concept string `json:"concept"`
	Reason  string `json:"reason"`
}

type LessonBlueprint struct {
	Introduction         string   `json:"introduction"`
	Objectives           []string `json:"objectives"`
	PrerequisiteConcepts []string `json:"prerequisite_concepts"`
	ConceptOutline       []string `json:"concept_outline"`
	Analogies            []string `json:"analogies"`
	Demonstration        []string `json:"demonstration"`
	GuidedPractice       []string `json:"guided_practice"`
	IndependentPractice  []string `json:"independent_practice"`
	KnowledgeCheck       []string `json:"knowledge_check"`
	Summary              string   `json:"summary"`
}

type ExerciseBlueprint struct {
	Title               string   `json:"title"`
	Description         string   `json:"description"`
	Difficulty          string   `json:"difficulty"`
	Competency          string   `json:"competency"`
	Instructions        []string `json:"instructions"`
	ExpectedDeliverable string   `json:"expected_deliverable"`
	EvaluationCriteria  []string `json:"evaluation_criteria"`
}

type KnowledgeCheckBlueprint struct {
	Description   string   `json:"description"`
	QuestionCount int      `json:"question_count"`
	Competencies  []string `json:"competencies"`
}

type Lesson struct {
	ID                       string          `json:"id"`
	SourceID                 string          `json:"source_id"`
	Sequence                 int             `json:"sequence"`
	Title                    string          `json:"title"`
	Description              string          `json:"description"`
	EstimatedDurationMinutes int             `json:"estimated_duration_minutes"`
	Blueprint                LessonBlueprint `json:"blueprint"`
}

type Reference struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type CourseClass struct {
	ID                       string                  `json:"id"`
	SourceID                 string                  `json:"source_id"`
	Sequence                 int                     `json:"sequence"`
	Title                    string                  `json:"title"`
	Description              string                  `json:"description"`
	Objectives               []Objective             `json:"objectives"`
	PrerequisiteClassIDs     []string                `json:"prerequisite_class_ids"`
	Prerequisites            []Reference             `json:"prerequisites"`
	EstimatedDurationMinutes int                     `json:"estimated_duration_minutes"`
	KeyConcepts              []string                `json:"key_concepts"`
	Lessons                  []Lesson                `json:"lessons"`
	Exercise                 *ExerciseBlueprint      `json:"exercise,omitempty"`
	KnowledgeCheck           KnowledgeCheckBlueprint `json:"knowledge_check"`
}

type CourseModule struct {
	ID                        string        `json:"id"`
	SourceID                  string        `json:"source_id"`
	Sequence                  int           `json:"sequence"`
	Title                     string        `json:"title"`
	Description               string        `json:"description"`
	Objectives                []Objective   `json:"objectives"`
	Skills                    []string      `json:"skills"`
	EstimatedDurationMinutes  int           `json:"estimated_duration_minutes"`
	RequiredPreviousModuleIDs []string      `json:"required_previous_module_ids"`
	RequiredPreviousModules   []Reference   `json:"required_previous_modules"`
	Classes                   []CourseClass `json:"classes"`
}

type FinalProject struct {
	Title              string   `json:"title"`
	Description        string   `json:"description"`
	Competencies       []string `json:"competencies"`
	Deliverable        string   `json:"deliverable"`
	EvaluationCriteria []string `json:"evaluation_criteria"`
}

type FinalAssessment struct {
	Title           string   `json:"title"`
	Description     string   `json:"description"`
	Format          string   `json:"format"`
	Competencies    []string `json:"competencies"`
	PassingCriteria []string `json:"passing_criteria"`
}

type GenerationMetadata struct {
	Provider       string `json:"provider"`
	Model          string `json:"model"`
	GeneratedAt    string `json:"generated_at"`
	PromptVersion  string `json:"prompt_version"`
	DurationMS     int    `json:"duration_ms"`
	Repaired       bool   `json:"repaired"`
	FallbackUsed   bool   `json:"fallback_used"`
	FallbackReason string `json:"fallback_reason,omitempty"`
}

type CourseBlueprint struct {
	Title                         string           `json:"title"`
	ShortDescription              string           `json:"short_description"`
	Description                   string           `json:"description"`
	LearningGoal                  string           `json:"learning_goal"`
	TargetLearnerLevel            string           `json:"target_learner_level"`
	TargetCompetencies            []Competency     `json:"target_competencies"`
	Prerequisites                 []Prerequisite   `json:"prerequisites"`
	EstimatedDurationMinutes      int              `json:"estimated_duration_minutes"`
	RecommendedWeeklyStudyMinutes int              `json:"recommended_weekly_study_minutes"`
	Methodology                   string           `json:"methodology"`
	ExpectedOutcome               string           `json:"expected_outcome"`
	Objectives                    []Objective      `json:"objectives"`
	Modules                       []CourseModuleAI `json:"modules"`
	FinalProject                  FinalProject     `json:"final_project"`
	FinalAssessment               FinalAssessment  `json:"final_assessment"`
	Assumptions                   []string         `json:"assumptions"`
	SuggestedSearchTopics         []string         `json:"suggested_search_topics"`
}

// CourseModuleAI mirrors the AI schema. Class IDs are AI source ids; the store maps
// them to database UUIDs after insertion.
type CourseModuleAI struct {
	ID                        string      `json:"id"`
	Sequence                  int         `json:"sequence"`
	Title                     string      `json:"title"`
	Description               string      `json:"description"`
	Objectives                []Objective `json:"objectives"`
	Skills                    []string    `json:"skills"`
	EstimatedDurationMinutes  int         `json:"estimated_duration_minutes"`
	RequiredPreviousModuleIDs []string    `json:"required_previous_module_ids"`
	Classes                   []ClassAI   `json:"classes"`
}

type ClassAI struct {
	ID                       string                  `json:"id"`
	Sequence                 int                     `json:"sequence"`
	Title                    string                  `json:"title"`
	Description              string                  `json:"description"`
	Objectives               []Objective             `json:"objectives"`
	PrerequisiteClassIDs     []string                `json:"prerequisite_class_ids"`
	EstimatedDurationMinutes int                     `json:"estimated_duration_minutes"`
	KeyConcepts              []string                `json:"key_concepts"`
	Lessons                  []LessonAI              `json:"lessons"`
	Exercise                 ExerciseBlueprint       `json:"exercise"`
	KnowledgeCheck           KnowledgeCheckBlueprint `json:"knowledge_check"`
}

type LessonAI struct {
	ID                       string          `json:"id"`
	Sequence                 int             `json:"sequence"`
	Title                    string          `json:"title"`
	Description              string          `json:"description"`
	EstimatedDurationMinutes int             `json:"estimated_duration_minutes"`
	Blueprint                LessonBlueprint `json:"blueprint"`
}

type CourseGenerationResult struct {
	Course   CourseBlueprint    `json:"course"`
	Warnings []string           `json:"warnings"`
	Metadata GenerationMetadata `json:"metadata"`
}

type CourseVersion struct {
	ID                            string             `json:"id"`
	CourseID                      string             `json:"course_id"`
	VersionNumber                 int                `json:"version_number"`
	Status                        string             `json:"status"`
	Title                         string             `json:"title"`
	ShortDescription              string             `json:"short_description"`
	Description                   string             `json:"description"`
	LearningGoal                  string             `json:"learning_goal"`
	TargetLearnerLevel            string             `json:"target_learner_level"`
	Objectives                    []Objective        `json:"objectives"`
	TargetCompetencies            []Competency       `json:"target_competencies"`
	Prerequisites                 []Prerequisite     `json:"prerequisites"`
	EstimatedDurationMinutes      int                `json:"estimated_duration_minutes"`
	RecommendedWeeklyStudyMinutes int                `json:"recommended_weekly_study_minutes"`
	Methodology                   string             `json:"methodology"`
	ExpectedOutcome               string             `json:"expected_outcome"`
	FinalProject                  FinalProject       `json:"final_project"`
	FinalAssessment               FinalAssessment    `json:"final_assessment"`
	Assumptions                   []string           `json:"assumptions"`
	SuggestedSearchTopics         []string           `json:"suggested_search_topics"`
	GenerationMetadata            GenerationMetadata `json:"generation_metadata"`
	Warnings                      []string           `json:"warnings"`
	CreatedAt                     time.Time          `json:"created_at"`
	ApprovedAt                    *time.Time         `json:"approved_at,omitempty"`
	Modules                       []CourseModule     `json:"modules"`
}

type CourseDetail struct {
	ID                string         `json:"id"`
	LearningGoalID    string         `json:"learning_goal_id"`
	Status            string         `json:"status"`
	CurrentVersionID  *string        `json:"current_version_id,omitempty"`
	ApprovedVersionID *string        `json:"approved_version_id,omitempty"`
	Version           *CourseVersion `json:"version"`
	ApprovedVersion   *CourseVersion `json:"approved_version,omitempty"`
	Counts            CourseCounts   `json:"counts"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type CourseCounts struct {
	Modules   int `json:"modules"`
	Classes   int `json:"classes"`
	Lessons   int `json:"lessons"`
	Exercises int `json:"exercises"`
}

type CourseSummary struct {
	ID                       string       `json:"id"`
	LearningGoalID           string       `json:"learning_goal_id"`
	Status                   string       `json:"status"`
	CurrentVersionID         *string      `json:"current_version_id,omitempty"`
	ApprovedVersionID        *string      `json:"approved_version_id,omitempty"`
	DraftVersionID           *string      `json:"draft_version_id,omitempty"`
	HasDraft                 bool         `json:"has_draft"`
	Title                    string       `json:"title"`
	ShortDescription         string       `json:"short_description"`
	VersionNumber            int          `json:"version_number"`
	VersionStatus            string       `json:"version_status"`
	TargetLearnerLevel       string       `json:"target_learner_level"`
	EstimatedDurationMinutes int          `json:"estimated_duration_minutes"`
	Counts                   CourseCounts `json:"counts"`
	CreatedAt                time.Time    `json:"created_at"`
	UpdatedAt                time.Time    `json:"updated_at"`
}

type LessonContent struct {
	ContentType string          `json:"content_type"`
	Content     json.RawMessage `json:"content"`
}
