package validate

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/google/uuid"
)

func NormalizeGoalInput(input *domain.CreateLearningGoalInput) []string {
	input.Title = strings.TrimSpace(input.Title)
	input.GoalStatement = strings.TrimSpace(input.GoalStatement)
	input.IntendedOutcome = strings.TrimSpace(input.IntendedOutcome)
	input.Motivation = strings.TrimSpace(input.Motivation)
	input.AdditionalContext = strings.TrimSpace(input.AdditionalContext)
	input.SelfReportedLevel = strings.TrimSpace(input.SelfReportedLevel)
	input.LearningLanguage = strings.TrimSpace(input.LearningLanguage)
	if input.LearningLanguage == "" {
		input.LearningLanguage = "en-US"
	}
	if input.SelfReportedLevel == "" {
		input.SelfReportedLevel = "unsure"
	}
	if input.WeeklyStudyMinutes == 0 {
		input.WeeklyStudyMinutes = 300
	}
	if input.CurrentKnowledge == nil {
		input.CurrentKnowledge = map[string]any{}
	}
	if input.LearningPreferences == nil {
		input.LearningPreferences = map[string]any{}
	}

	errors := []string{}
	if length := len([]rune(input.Title)); length < 3 || length > 160 {
		errors = append(errors, "title must be between 3 and 160 characters")
	}
	if length := len([]rune(input.GoalStatement)); length < 8 || length > 2000 {
		errors = append(errors, "goal_statement must be between 8 and 2000 characters")
	}
	if length := len([]rune(input.IntendedOutcome)); length < 8 || length > 2000 {
		errors = append(errors, "intended_outcome must be between 8 and 2000 characters")
	}
	if length := len([]rune(input.Motivation)); length < 3 || length > 1500 {
		errors = append(errors, "motivation must be between 3 and 1500 characters")
	}
	if len([]rune(input.AdditionalContext)) > 4000 {
		errors = append(errors, "additional_context must be at most 4000 characters")
	}
	if !oneOf(input.SelfReportedLevel, "beginner", "basic", "intermediate", "advanced", "unsure") {
		errors = append(errors, "self_reported_level is invalid")
	}
	if input.WeeklyStudyMinutes < 30 || input.WeeklyStudyMinutes > 10_080 {
		errors = append(errors, "weekly_study_minutes must be between 30 and 10080")
	}
	if !oneOf(input.LearningLanguage, "id-ID", "en-US") {
		errors = append(errors, "learning_language must be id-ID or en-US")
	}
	if input.TargetDate != nil {
		trimmed := strings.TrimSpace(*input.TargetDate)
		if trimmed == "" {
			input.TargetDate = nil
		} else {
			parsed, err := time.Parse("2006-01-02", trimmed)
			if err != nil {
				errors = append(errors, "target_date must use YYYY-MM-DD")
			} else if parsed.Before(time.Now().AddDate(0, 0, -1)) {
				errors = append(errors, "target_date must not be in the past")
			} else {
				input.TargetDate = &trimmed
			}
		}
	}
	if size, err := jsonSize(input.CurrentKnowledge); err != nil || size > 20_000 {
		errors = append(errors, "current_knowledge is too large or invalid")
	}
	if size, err := jsonSize(input.LearningPreferences); err != nil || size > 20_000 {
		errors = append(errors, "learning_preferences is too large or invalid")
	}
	return errors
}

func Answers(answers []domain.DiagnosticAnswer, questionIDs map[string]bool) []string {
	errors := []string{}
	if len(answers) < 5 || len(answers) > 8 {
		errors = append(errors, "a diagnostic submission must contain 5 to 8 answers")
	}
	seen := map[string]bool{}
	for index := range answers {
		answers[index].QuestionID = strings.TrimSpace(answers[index].QuestionID)
		answers[index].Response = strings.TrimSpace(answers[index].Response)
		if !questionIDs[answers[index].QuestionID] {
			errors = append(errors, fmt.Sprintf("unknown question %q", answers[index].QuestionID))
			continue
		}
		if seen[answers[index].QuestionID] {
			errors = append(errors, fmt.Sprintf("duplicate answer for question %q", answers[index].QuestionID))
		}
		seen[answers[index].QuestionID] = true
		if answers[index].Response == "" {
			errors = append(errors, fmt.Sprintf("answer for %q must not be empty", answers[index].QuestionID))
		}
		if len([]rune(answers[index].Response)) > 5000 {
			errors = append(errors, fmt.Sprintf("answer for %q is too long", answers[index].QuestionID))
		}
	}
	if len(seen) != len(questionIDs) {
		errors = append(errors, "every diagnostic question must be answered exactly once")
	}
	return errors
}

func DraftPatch(patch *domain.UpdateDraftInput) []string {
	errors := []string{}
	if _, err := uuid.Parse(strings.TrimSpace(patch.VersionID)); err != nil {
		errors = append(errors, "version_id must be a UUID")
	}
	if patch.Title != nil {
		trimmed := strings.TrimSpace(*patch.Title)
		patch.Title = &trimmed
		if len([]rune(trimmed)) < 3 || len([]rune(trimmed)) > 160 {
			errors = append(errors, "title must be between 3 and 160 characters")
		}
	}
	if patch.ShortDescription != nil {
		trimmed := strings.TrimSpace(*patch.ShortDescription)
		patch.ShortDescription = &trimmed
		if len([]rune(trimmed)) < 10 || len([]rune(trimmed)) > 400 {
			errors = append(errors, "short_description must be between 10 and 400 characters")
		}
	}
	if patch.Description != nil {
		trimmed := strings.TrimSpace(*patch.Description)
		patch.Description = &trimmed
		if len([]rune(trimmed)) < 3 || len([]rune(trimmed)) > 4000 {
			errors = append(errors, "description must be between 3 and 4000 characters")
		}
	}
	for index := range patch.Modules {
		patch.Modules[index].ID = strings.TrimSpace(patch.Modules[index].ID)
		if _, err := uuid.Parse(patch.Modules[index].ID); err != nil {
			errors = append(errors, "module id must be a UUID")
		}
		if patch.Modules[index].Title != nil {
			trimmed := strings.TrimSpace(*patch.Modules[index].Title)
			patch.Modules[index].Title = &trimmed
			if len([]rune(trimmed)) < 2 || len([]rune(trimmed)) > 200 {
				errors = append(errors, "module title must be between 2 and 200 characters")
			}
		}
		if patch.Modules[index].Description != nil && len([]rune(*patch.Modules[index].Description)) > 2000 {
			errors = append(errors, "module description is too long")
		}
	}
	for index := range patch.Classes {
		patch.Classes[index].ID = strings.TrimSpace(patch.Classes[index].ID)
		if _, err := uuid.Parse(patch.Classes[index].ID); err != nil {
			errors = append(errors, "class id must be a UUID")
		}
		if patch.Classes[index].Title != nil {
			trimmed := strings.TrimSpace(*patch.Classes[index].Title)
			patch.Classes[index].Title = &trimmed
			if len([]rune(trimmed)) < 2 || len([]rune(trimmed)) > 200 {
				errors = append(errors, "class title must be between 2 and 200 characters")
			}
		}
		if patch.Classes[index].Description != nil && len([]rune(*patch.Classes[index].Description)) > 2000 {
			errors = append(errors, "class description is too long")
		}
	}
	if patch.Title == nil && patch.ShortDescription == nil && patch.Description == nil &&
		len(patch.Modules) == 0 && len(patch.Classes) == 0 {
		errors = append(errors, "no changes were supplied")
	}
	return errors
}

func oneOf(value string, allowed ...string) bool {
	for _, item := range allowed {
		if value == item {
			return true
		}
	}
	return false
}

func jsonSize(value any) (int, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return 0, err
	}
	return len(data), nil
}
