package validate

import (
	"strings"
	"testing"

	"github.com/frikhii/copilot/core-api/internal/domain"
)

func validCourse() domain.CourseBlueprint {
	return domain.CourseBlueprint{
		Title:                         "Build a Go service",
		ShortDescription:              "A practical, project-based Go course.",
		Description:                   "Learn to build and test a Go service.",
		LearningGoal:                  "Ship a small production service.",
		TargetLearnerLevel:            "beginner",
		EstimatedDurationMinutes:      240,
		RecommendedWeeklyStudyMinutes: 180,
		Methodology:                   "Practice first.",
		ExpectedOutcome:               "A tested service.",
		Objectives:                    []domain.Objective{{ID: "obj-1", Description: "Explain the runtime.", Competency: "go"}},
		TargetCompetencies:            []domain.Competency{{ID: "comp-1", Name: "Go", Description: "Build Go programs."}},
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
				EstimatedDurationMinutes: 120,
				KeyConcepts:              []string{"goroutine"},
				Exercise: domain.ExerciseBlueprint{
					Title:               "Practice",
					Description:         "Write a concurrent program.",
					Difficulty:          "foundation",
					Competency:          "go",
					Instructions:        []string{"Write it."},
					ExpectedDeliverable: "A program.",
					EvaluationCriteria:  []string{"It runs."},
				},
				KnowledgeCheck: domain.KnowledgeCheckBlueprint{Description: "Check understanding.", QuestionCount: 2, Competencies: []string{"go"}},
				Lessons: []domain.LessonAI{{
					ID:                       "lesson-1",
					Sequence:                 1,
					Title:                    "Starting goroutines",
					Description:              "Observe concurrency.",
					EstimatedDurationMinutes: 45,
					Blueprint: domain.LessonBlueprint{
						Introduction:        "An introduction.",
						Objectives:          []string{"Start a goroutine."},
						ConceptOutline:      []string{"Concept"},
						Analogies:           []string{"An analogy"},
						Demonstration:       []string{"A demo"},
						GuidedPractice:      []string{"Guided practice"},
						IndependentPractice: []string{"Independent practice"},
						KnowledgeCheck:      []string{"A check"},
						Summary:             "A summary.",
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
	}
}

func TestCurriculumAcceptsValidCourse(t *testing.T) {
	if problems := Curriculum(validCourse()); len(problems) != 0 {
		t.Fatalf("expected valid course, got %v", problems)
	}
}

func TestCurriculumRejectsStructuralProblems(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*domain.CourseBlueprint)
		want   string
	}{
		{
			name: "duplicate lesson id",
			mutate: func(course *domain.CourseBlueprint) {
				course.Modules[0].Classes[0].Lessons = append(course.Modules[0].Classes[0].Lessons, course.Modules[0].Classes[0].Lessons[0])
			},
			want: "duplicate id",
		},
		{
			name: "unknown module prerequisite",
			mutate: func(course *domain.CourseBlueprint) {
				course.Modules[0].RequiredPreviousModuleIDs = []string{"missing"}
			},
			want: "unknown module",
		},
		{
			name: "class prerequisite is not earlier",
			mutate: func(course *domain.CourseBlueprint) {
				course.Modules[0].Classes[0].PrerequisiteClassIDs = []string{"class-1"}
			},
			want: "not earlier",
		},
		{
			name: "url in generated content",
			mutate: func(course *domain.CourseBlueprint) {
				course.Modules[0].Classes[0].Description = "See https://example.com for more."
			},
			want: "URL",
		},
		{
			name: "missing exercise criteria",
			mutate: func(course *domain.CourseBlueprint) {
				course.Modules[0].Classes[0].Exercise.EvaluationCriteria = nil
			},
			want: "evaluation criteria",
		},
		{
			name: "non-contiguous module sequence",
			mutate: func(course *domain.CourseBlueprint) {
				course.Modules[0].Sequence = 2
			},
			want: "non-contiguous",
		},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			course := validCourse()
			test.mutate(&course)
			problems := Curriculum(course)
			if !strings.Contains(strings.Join(problems, "\n"), test.want) {
				t.Fatalf("expected %q in problems, got %v", test.want, problems)
			}
		})
	}
}

func TestAnswersRequiresTrimmedNonEmptyResponses(t *testing.T) {
	questionIDs := map[string]bool{"q1": true, "q2": true, "q3": true, "q4": true, "q5": true}
	answers := []domain.DiagnosticAnswer{
		{QuestionID: " q1 ", Response: "  a considered answer  "},
		{QuestionID: "q2", Response: "   "},
		{QuestionID: "q3", Response: "answer"},
		{QuestionID: "q4", Response: "answer"},
		{QuestionID: "q5", Response: "answer"},
	}
	problems := Answers(answers, questionIDs)
	joined := strings.Join(problems, "\n")
	if !strings.Contains(joined, "must not be empty") {
		t.Fatalf("expected an empty-answer problem, got %v", problems)
	}
	if answers[0].QuestionID != "q1" || answers[0].Response != "a considered answer" {
		t.Fatalf("answers were not trimmed in place: %#v", answers[0])
	}
}

func TestNormalizeGoalInputDefaultsAndDates(t *testing.T) {
	input := domain.CreateLearningGoalInput{
		Title:             "  Learn Go  ",
		GoalStatement:     "  Build a real service.  ",
		IntendedOutcome:   "  Ship it.  ",
		Motivation:        "  Work.  ",
		SelfReportedLevel: "",
		LearningLanguage:  "",
	}
	if problems := NormalizeGoalInput(&input); len(problems) != 0 {
		t.Fatalf("unexpected problems: %v", problems)
	}
	if input.Title != "Learn Go" || input.LearningLanguage != "en-US" || input.SelfReportedLevel != "unsure" || input.WeeklyStudyMinutes != 300 {
		t.Fatalf("defaults were not applied: %#v", input)
	}
	past := "2000-01-01"
	input.TargetDate = &past
	if problems := NormalizeGoalInput(&input); !strings.Contains(strings.Join(problems, "\n"), "past") {
		t.Fatalf("expected a past-date problem, got %v", problems)
	}
}
