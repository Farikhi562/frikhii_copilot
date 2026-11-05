package store

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/frikhii/copilot/core-api/internal/domain"
)

const (
	testUser  = "11111111-1111-1111-1111-111111111111"
	otherUser = "22222222-2222-2222-2222-222222222222"
)

func testGoalInput() domain.CreateLearningGoalInput {
	return domain.CreateLearningGoalInput{
		Title:               "Build production Go services",
		GoalStatement:       "I want to design and ship a production Go service.",
		IntendedOutcome:     "I can build, test, deploy, and operate a Go API.",
		Motivation:          "My team is moving its backend to Go.",
		SelfReportedLevel:   "basic",
		CurrentKnowledge:    map[string]any{"go": "basics", "sql": "some"},
		WeeklyStudyMinutes:  360,
		LearningLanguage:    "en-US",
		LearningPreferences: map[string]any{"style": "hands-on"},
	}
}

func testQuestions() []Question {
	return []Question{
		{SourceID: "q-1", Sequence: 1, Type: "multiple_choice", Prompt: "Which keyword starts a goroutine?", Competency: "concurrency", Difficulty: "foundation", Choices: []domain.Choice{{ID: "a", Text: "go"}, {ID: "b", Text: "async"}}, Explanation: "go starts a goroutine."},
		{SourceID: "q-2", Sequence: 2, Type: "short_answer", Prompt: "Explain how a channel blocks.", Competency: "concurrency", Difficulty: "intermediate", Choices: []domain.Choice{}, Explanation: "Unbuffered channels block until both sides meet."},
		{SourceID: "q-3", Sequence: 3, Type: "scenario", Prompt: "Design a timeout for an HTTP client.", Competency: "http", Difficulty: "intermediate", Choices: []domain.Choice{}, Explanation: "Use context.WithTimeout."},
		{SourceID: "q-4", Sequence: 4, Type: "reasoning", Prompt: "Why avoid unbounded goroutines?", Competency: "concurrency", Difficulty: "advanced", Choices: []domain.Choice{}, Explanation: "They leak memory and overload dependencies."},
		{SourceID: "q-5", Sequence: 5, Type: "multiple_choice", Prompt: "Which package runs tests?", Competency: "testing", Difficulty: "foundation", Choices: []domain.Choice{{ID: "a", Text: "testing"}, {ID: "b", Text: "assert"}}, Explanation: "The testing package is built in."},
	}
}

func testKeys() []domain.AnswerKey {
	keys := []domain.AnswerKey{}
	for _, question := range testQuestions() {
		keys = append(keys, domain.AnswerKey{
			QuestionID:     question.SourceID,
			ExpectedAnswer: "A correct explanation.",
			Rubric:         []domain.RubricCriterion{{Criterion: "accuracy", Description: "The answer is accurate.", Weight: 1}},
		})
	}
	return keys
}

func testBlueprint(title string) domain.CourseBlueprint {
	blueprint := domain.CourseBlueprint{
		Title:                         title,
		ShortDescription:              "A practical course for building Go services.",
		Description:                   "Learn the core practices for building reliable Go services.",
		LearningGoal:                  "Build and operate a production Go service.",
		TargetLearnerLevel:            "beginner",
		EstimatedDurationMinutes:      360,
		RecommendedWeeklyStudyMinutes: 360,
		Methodology:                   "Short lessons, guided practice, and a final project.",
		ExpectedOutcome:               "You can build and test a small Go API.",
		Objectives: []domain.Objective{
			{ID: "obj-1", Description: "Explain the Go execution model.", Competency: "concurrency"},
		},
		TargetCompetencies: []domain.Competency{
			{ID: "comp-1", Name: "Concurrency", Description: "Reason about goroutines and channels."},
		},
		Prerequisites: []domain.Prerequisite{},
		FinalProject: domain.FinalProject{
			Title:              "Build an API",
			Description:        "Build a small HTTP API with tests.",
			Competencies:       []string{"Concurrency"},
			Deliverable:        "A tested HTTP API.",
			EvaluationCriteria: []string{"Tests pass", "Handles errors"},
		},
		FinalAssessment: domain.FinalAssessment{
			Title:           "Final assessment",
			Description:     "Demonstrate the outcomes.",
			Format:          "Project review",
			Competencies:    []string{"Concurrency"},
			PassingCriteria: []string{"All criteria met"},
		},
		Assumptions:           []string{"You can read basic code."},
		SuggestedSearchTopics: []string{"Go context", "Go testing"},
	}
	blueprint.Modules = []domain.CourseModuleAI{{
		ID:                        "module-1",
		Sequence:                  1,
		Title:                     "Foundations",
		Description:               "The execution model and your first service.",
		Objectives:                []domain.Objective{{ID: "obj-m1", Description: "Describe the Go runtime.", Competency: "concurrency"}},
		Skills:                    []string{"Running Go programs"},
		EstimatedDurationMinutes:  360,
		RequiredPreviousModuleIDs: []string{},
		Classes: []domain.ClassAI{
			{
				ID:                       "class-1",
				Sequence:                 1,
				Title:                    "Goroutines",
				Description:              "Understand goroutines and scheduling.",
				Objectives:               []domain.Objective{{ID: "obj-c1", Description: "Start and coordinate goroutines.", Competency: "concurrency"}},
				PrerequisiteClassIDs:     []string{},
				EstimatedDurationMinutes: 90,
				KeyConcepts:              []string{"goroutine", "scheduler"},
				KnowledgeCheck:           domain.KnowledgeCheckBlueprint{Description: "Check the execution model.", QuestionCount: 3, Competencies: []string{"concurrency"}},
				Exercise:                 testExercise("goroutines"),
				Lessons: []domain.LessonAI{{
					ID: "lesson-1", Sequence: 1, Title: "Starting goroutines",
					Description: "Write and observe concurrent work.", EstimatedDurationMinutes: 45,
					Blueprint: testLessonBlueprint("goroutine"),
				}},
			},
			{
				ID:                       "class-2",
				Sequence:                 2,
				Title:                    "Channels",
				Description:              "Coordinate goroutines with channels.",
				Objectives:               []domain.Objective{{ID: "obj-c2", Description: "Use channels to share data safely.", Competency: "concurrency"}},
				PrerequisiteClassIDs:     []string{"class-1"},
				EstimatedDurationMinutes: 90,
				KeyConcepts:              []string{"channel", "select"},
				KnowledgeCheck:           domain.KnowledgeCheckBlueprint{Description: "Check channel usage.", QuestionCount: 3, Competencies: []string{"concurrency"}},
				Exercise:                 testExercise("channels"),
				Lessons: []domain.LessonAI{{
					ID: "lesson-2", Sequence: 1, Title: "Channel patterns",
					Description: "Practice fan-in and fan-out.", EstimatedDurationMinutes: 45,
					Blueprint: testLessonBlueprint("channel"),
				}},
			},
		},
	}}
	return blueprint
}

func testExercise(topic string) domain.ExerciseBlueprint {
	return domain.ExerciseBlueprint{
		Title:               "Practice " + topic,
		Description:         "Apply the concepts in a small program.",
		Difficulty:          "foundation",
		Competency:          "concurrency",
		Instructions:        []string{"Write a program.", "Run it with the race detector."},
		ExpectedDeliverable: "A working program and notes.",
		EvaluationCriteria:  []string{"The program compiles.", "Concurrency is safe."},
	}
}

func testLessonBlueprint(topic string) domain.LessonBlueprint {
	return domain.LessonBlueprint{
		Introduction:         "Introduce " + topic + ".",
		Objectives:           []string{"Explain " + topic + "."},
		PrerequisiteConcepts: []string{"functions"},
		ConceptOutline:       []string{"Concept one", "Concept two"},
		Analogies:            []string{"Like coordinating coworkers."},
		Demonstration:        []string{"Walk through an example."},
		GuidedPractice:       []string{"Solve a small task together."},
		IndependentPractice:  []string{"Extend the example."},
		KnowledgeCheck:       []string{"What did you observe?"},
		Summary:              "Summarize " + topic + ".",
	}
}

func TestMemoryCourseLifecycleAndVersionHistory(t *testing.T) {
	ctx := context.Background()
	memory := NewMemory()
	goal, err := memory.CreateLearningGoal(ctx, testUser, testGoalInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := memory.BeginGeneration(ctx, testUser, goal.ID, time.Minute); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("generation before a diagnostic must fail, got %v", err)
	}

	attempt, err := memory.CreateDiagnosticAttempt(ctx, testUser, goal.ID, testQuestions(), testKeys())
	if err != nil {
		t.Fatal(err)
	}
	if attempt.Status != "ready" || len(attempt.Questions) != 5 {
		t.Fatalf("unexpected attempt: %#v", attempt)
	}
	answers := []domain.DiagnosticAnswer{}
	for _, question := range testQuestions() {
		answers = append(answers, domain.DiagnosticAnswer{QuestionID: question.SourceID, Response: "A considered answer."})
	}
	submitted, err := memory.SubmitDiagnosticAnswers(ctx, testUser, goal.ID, attempt.ID, answers)
	if err != nil {
		t.Fatal(err)
	}
	if submitted.Status != "submitted" || len(submitted.Answers) != 5 {
		t.Fatalf("unexpected submission: %#v", submitted)
	}
	evaluation := domain.DiagnosticEvaluation{
		EstimatedLevel:   "beginner",
		Confidence:       "medium",
		Summary:          "Ready to build.",
		Strengths:        []domain.Strength{{Competency: "concurrency", Evidence: "Explained goroutines."}},
		Gaps:             []domain.KnowledgeGap{{Competency: "testing", Description: "Needs practice.", Severity: "medium", Recommendation: "Write tests."}},
		Misconceptions:   []string{},
		RecommendedStart: "Foundations",
		Rationale:        "The answers show baseline knowledge.",
		QuestionScores: []domain.QuestionScore{
			{QuestionID: "q-1", Score: 80, Feedback: "Correct."},
			{QuestionID: "q-2", Score: 60, Feedback: "Partially correct."},
			{QuestionID: "q-3", Score: 70, Feedback: "Good."},
			{QuestionID: "q-4", Score: 50, Feedback: "Needs work."},
			{QuestionID: "q-5", Score: 90, Feedback: "Correct."},
		},
		CanSkip: []string{"q-1"},
	}
	evaluated, err := memory.SaveDiagnosticEvaluation(ctx, testUser, goal.ID, attempt.ID, evaluation, nil)
	if err != nil {
		t.Fatal(err)
	}
	if evaluated.Status != "evaluated" || evaluated.EstimatedLevel == nil || *evaluated.EstimatedLevel != "beginner" {
		t.Fatalf("unexpected evaluation: %#v", evaluated)
	}

	if _, started, err := memory.BeginGeneration(ctx, testUser, goal.ID, time.Minute); err != nil || !started {
		t.Fatalf("begin generation: %v %v", started, err)
	}
	first, err := memory.CreateCourseVersion(ctx, testUser, goal.ID, testBlueprint("Go Foundations"), []string{}, domain.GenerationMetadata{Provider: "mock"})
	if err != nil {
		t.Fatal(err)
	}
	if first.Version == nil || first.Version.VersionNumber != 1 || first.Version.Status != "draft" {
		t.Fatalf("unexpected first version: %#v", first.Version)
	}
	if first.Counts.Modules != 1 || first.Counts.Classes != 2 || first.Counts.Lessons != 2 {
		t.Fatalf("unexpected counts: %#v", first.Counts)
	}
	if len(first.Version.Modules[0].Classes[1].Prerequisites) != 1 {
		t.Fatal("class prerequisite references were not resolved")
	}

	approved, err := memory.ApproveCourse(ctx, testUser, first.ID, first.Version.ID)
	if err != nil {
		t.Fatal(err)
	}
	if approved.Status != "approved" || approved.ApprovedVersion == nil || approved.ApprovedVersion.ID != first.Version.ID {
		t.Fatalf("unexpected approval: %#v", approved)
	}
	if !memory.Enrolled(testUser, first.ID) {
		t.Fatal("approval must create an enrollment")
	}
	if _, err := memory.ApproveCourse(ctx, testUser, first.ID, first.Version.ID); err != nil {
		t.Fatalf("duplicate approval must be idempotent: %v", err)
	}

	if _, started, err := memory.BeginGeneration(ctx, testUser, goal.ID, time.Minute); err != nil || !started {
		t.Fatalf("begin regeneration: %v %v", started, err)
	}
	second, err := memory.CreateCourseVersion(ctx, testUser, goal.ID, testBlueprint("Go Foundations v2"), []string{"revised"}, domain.GenerationMetadata{Provider: "mock"})
	if err != nil {
		t.Fatal(err)
	}
	if second.Version.VersionNumber != 2 || second.Version.Status != "draft" {
		t.Fatalf("unexpected second version: %#v", second.Version)
	}
	if second.ApprovedVersion == nil || second.ApprovedVersion.ID != first.Version.ID {
		t.Fatal("the previously approved version must remain approved while a new draft is reviewed")
	}
	if second.CurrentVersionID == nil || *second.CurrentVersionID != second.Version.ID {
		t.Fatal("the new draft must be the current version")
	}
	if _, err := memory.UpdateDraft(ctx, testUser, second.ID, domain.UpdateDraftInput{VersionID: first.Version.ID, Title: stringPtr("Nope")}); !errors.Is(err, ErrConflict) {
		t.Fatalf("approved version edit must conflict, got %v", err)
	}
	title := "Reviewed Go Foundations"
	updated, err := memory.UpdateDraft(ctx, testUser, second.ID, domain.UpdateDraftInput{VersionID: second.Version.ID, Title: &title})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Version.Title != title {
		t.Fatalf("draft edit was not applied: %q", updated.Version.Title)
	}

	final, err := memory.ApproveCourse(ctx, testUser, second.ID, second.Version.ID)
	if err != nil {
		t.Fatal(err)
	}
	if final.ApprovedVersion == nil || final.ApprovedVersion.ID != second.Version.ID {
		t.Fatal("the second version must be approved")
	}
	if final.ApprovedVersion.VersionNumber != 2 {
		t.Fatalf("unexpected approved version number %d", final.ApprovedVersion.VersionNumber)
	}

	other, err := memory.GetCourse(ctx, otherUser, second.ID)
	if !errors.Is(err, ErrNotFound) || other != nil {
		t.Fatalf("another user must not read the course: %#v %v", other, err)
	}
	if _, err := memory.ApproveCourse(ctx, otherUser, second.ID, second.Version.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("another user must not approve the course: %v", err)
	}
}

func TestMemoryGenerationLockAndOwnership(t *testing.T) {
	ctx := context.Background()
	memory := NewMemory()
	goal, err := memory.CreateLearningGoal(ctx, testUser, testGoalInput())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := memory.CreateDiagnosticAttempt(ctx, otherUser, goal.ID, testQuestions(), testKeys()); !errors.Is(err, ErrNotFound) {
		t.Fatalf("another user must not create a diagnostic: %v", err)
	}
	if _, err := memory.GetLearningGoal(ctx, otherUser, goal.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("another user must not read the goal: %v", err)
	}
	if err := memory.SetGoalStatus(ctx, testUser, goal.ID, "diagnostic_evaluated", nil); err != nil {
		t.Fatal(err)
	}
	if _, started, err := memory.BeginGeneration(ctx, testUser, goal.ID, time.Minute); err != nil || !started {
		t.Fatalf("begin: %v %v", started, err)
	}
	if _, started, err := memory.BeginGeneration(ctx, testUser, goal.ID, time.Minute); !errors.Is(err, ErrGenerationInProgress) || started {
		t.Fatalf("a second generation must be rejected: %v %v", started, err)
	}
}

func TestMemoryStaleGenerationCanBeReclaimed(t *testing.T) {
	ctx := context.Background()
	memory := NewMemory()
	current := time.Now().UTC()
	memory.now = func() time.Time { return current }
	goal, err := memory.CreateLearningGoal(ctx, testUser, testGoalInput())
	if err != nil {
		t.Fatal(err)
	}
	if err := memory.SetGoalStatus(ctx, testUser, goal.ID, "diagnostic_evaluated", nil); err != nil {
		t.Fatal(err)
	}
	if _, started, err := memory.BeginGeneration(ctx, testUser, goal.ID, time.Minute); err != nil || !started {
		t.Fatalf("begin: %v %v", started, err)
	}
	current = current.Add(2 * time.Minute)
	if _, started, err := memory.BeginGeneration(ctx, testUser, goal.ID, time.Minute); err != nil || !started {
		t.Fatalf("a stale generation should be reclaimable: %v %v", started, err)
	}
}
