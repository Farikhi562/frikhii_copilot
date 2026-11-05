package aiclient_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/frikhii/copilot/core-api/internal/validate"
)

// TestLiveAIContract runs only when AI_CONTRACT_URL points at a running AI
// Engine. It verifies the JSON contract between Go and Python and re-runs the
// Go structural validator on the engine's deterministic output.
func TestLiveAIContract(t *testing.T) {
	baseURL := os.Getenv("AI_CONTRACT_URL")
	if baseURL == "" {
		t.Skip("set AI_CONTRACT_URL to run the cross-service contract test")
	}
	token := os.Getenv("AI_CONTRACT_TOKEN")
	if token == "" {
		t.Fatal("AI_CONTRACT_TOKEN is required with AI_CONTRACT_URL")
	}
	client := aiclient.New(baseURL, token, 15*time.Second)
	goal := aiclient.GoalContext{
		Title:               "Build production Go services",
		GoalStatement:       "I want to design and ship a production Go service.",
		IntendedOutcome:     "I can build, test, deploy, and operate a Go API.",
		Motivation:          "My team is moving its backend to Go.",
		SelfReportedLevel:   "basic",
		CurrentKnowledge:    map[string]any{"go": "basics"},
		WeeklyStudyMinutes:  360,
		LearningLanguage:    "en-US",
		LearningPreferences: map[string]any{"style": "hands-on"},
	}

	diagnostic, err := client.GenerateDiagnostic(context.Background(), aiclient.DiagnosticGenerateRequest{
		LearningGoal: goal, QuestionCount: 6,
	})
	if err != nil {
		t.Fatalf("diagnostic: %v", err)
	}
	if len(diagnostic.QuestionSet.Questions) != 6 || len(diagnostic.AnswerKeys) != 6 {
		t.Fatalf("unexpected diagnostic shape: %d questions, %d keys", len(diagnostic.QuestionSet.Questions), len(diagnostic.AnswerKeys))
	}

	questions := make([]aiclient.AIQuestion, 0, len(diagnostic.QuestionSet.Questions))
	answers := make([]domain.DiagnosticAnswer, 0, len(diagnostic.QuestionSet.Questions))
	for _, question := range diagnostic.QuestionSet.Questions {
		questions = append(questions, question)
		answers = append(answers, domain.DiagnosticAnswer{QuestionID: question.ID, Response: "a"})
	}
	evaluation, err := client.EvaluateDiagnostic(context.Background(), aiclient.DiagnosticEvaluateRequest{
		LearningGoal: goal,
		Questions:    questions,
		AnswerKeys:   diagnostic.AnswerKeys,
		Answers:      answers,
	})
	if err != nil {
		t.Fatalf("evaluation: %v", err)
	}
	if evaluation.Evaluation.EstimatedLevel == "" || len(evaluation.Evaluation.QuestionScores) != 6 {
		t.Fatalf("unexpected evaluation: %#v", evaluation.Evaluation)
	}

	generated, err := client.GenerateCourse(context.Background(), aiclient.CurriculumGenerateRequest{
		LearningGoal: goal,
		Diagnostic: aiclient.DiagnosticContext{
			EstimatedLevel:   evaluation.Evaluation.EstimatedLevel,
			Confidence:       evaluation.Evaluation.Confidence,
			Summary:          evaluation.Evaluation.Summary,
			Strengths:        evaluation.Evaluation.Strengths,
			Gaps:             evaluation.Evaluation.Gaps,
			RecommendedStart: evaluation.Evaluation.RecommendedStart,
			Rationale:        evaluation.Evaluation.Rationale,
		},
	})
	if err != nil {
		t.Fatalf("course: %v", err)
	}
	if problems := validate.Curriculum(generated.Course); len(problems) > 0 {
		t.Fatalf("the engine's course failed Go validation: %v", problems)
	}
	if generated.Metadata.Provider != "mock" {
		t.Fatalf("unexpected provider metadata: %#v", generated.Metadata)
	}
}
