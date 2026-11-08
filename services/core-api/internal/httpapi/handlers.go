package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/frikhii/copilot/core-api/internal/store"
	"github.com/frikhii/copilot/core-api/internal/validate"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

func (s *Server) createLearningGoal(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateLearningGoalInput
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	if problems := validate.NormalizeGoalInput(&input); len(problems) > 0 {
		writeValidation(w, r, problems)
		return
	}
	goal, err := s.store.CreateLearningGoal(r.Context(), userID(r), input)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"learning_goal": goal})
}

func (s *Server) listLearningGoals(w http.ResponseWriter, r *http.Request) {
	goals, err := s.store.ListLearningGoals(r.Context(), userID(r))
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"learning_goals": goals})
}

func (s *Server) getLearningGoal(w http.ResponseWriter, r *http.Request) {
	goal, err := s.store.GetLearningGoal(r.Context(), userID(r), chi.URLParam(r, "goalID"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"learning_goal": goal})
}

func (s *Server) generateDiagnostic(w http.ResponseWriter, r *http.Request) {
	goalID := chi.URLParam(r, "goalID")
	existing, err := s.store.GetLatestDiagnostic(r.Context(), userID(r), goalID)
	if err == nil {
		switch existing.Status {
		case "ready", "submitted", "evaluated":
			writeJSON(w, http.StatusOK, map[string]any{"diagnostic": existing})
			return
		case "generating":
			writeError(w, r, store.ErrGenerationInProgress)
			return
		}
	} else if !errors.Is(err, store.ErrNotFound) {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}

	ai, ok := s.requireAI(w, r)
	if !ok {
		return
	}
	goal, err := s.store.GetLearningGoal(r.Context(), userID(r), goalID)
	if err != nil {
		writeError(w, r, err)
		return
	}

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	response, err := ai.GenerateDiagnostic(ctx, aiclient.DiagnosticGenerateRequest{
		LearningGoal:  goalContext(goal),
		QuestionCount: 6,
	})
	if err != nil {
		s.markGoalFailed(r, goalID, err)
		writeError(w, r, err)
		return
	}

	questions := make([]store.Question, 0, len(response.QuestionSet.Questions))
	for _, question := range response.QuestionSet.Questions {
		questions = append(questions, store.Question{
			SourceID:    question.ID,
			Sequence:    question.Sequence,
			Type:        question.Type,
			Prompt:      question.Prompt,
			Competency:  question.Competency,
			Difficulty:  question.Difficulty,
			Choices:     question.Choices,
			Explanation: question.Explanation,
		})
	}
	if len(questions) < 5 || len(questions) > 8 {
		s.markGoalFailed(r, goalID, aiclient.ErrInvalid)
		writeError(w, r, aiclient.ErrInvalid)
		return
	}
	questionIDs := make(map[string]bool, len(questions))
	sequences := make(map[int]bool, len(questions))
	for _, question := range questions {
		if strings.TrimSpace(question.SourceID) == "" || questionIDs[question.SourceID] {
			s.markGoalFailed(r, goalID, aiclient.ErrInvalid)
			writeError(w, r, aiclient.ErrInvalid)
			return
		}
		if question.Sequence < 1 || sequences[question.Sequence] {
			s.markGoalFailed(r, goalID, aiclient.ErrInvalid)
			writeError(w, r, aiclient.ErrInvalid)
			return
		}
		questionIDs[question.SourceID] = true
		sequences[question.Sequence] = true
	}
	keyIDs := make(map[string]bool, len(response.AnswerKeys))
	for _, key := range response.AnswerKeys {
		if !questionIDs[key.QuestionID] || keyIDs[key.QuestionID] || strings.TrimSpace(key.ExpectedAnswer) == "" {
			s.markGoalFailed(r, goalID, aiclient.ErrInvalid)
			writeError(w, r, aiclient.ErrInvalid)
			return
		}
		keyIDs[key.QuestionID] = true
	}
	if len(keyIDs) != len(questionIDs) {
		s.markGoalFailed(r, goalID, aiclient.ErrInvalid)
		writeError(w, r, aiclient.ErrInvalid)
		return
	}
	attempt, err := s.store.CreateDiagnosticAttempt(r.Context(), userID(r), goalID, questions, response.AnswerKeys)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"diagnostic": attempt})
}

func (s *Server) getDiagnostic(w http.ResponseWriter, r *http.Request) {
	attempt, err := s.store.GetLatestDiagnostic(r.Context(), userID(r), chi.URLParam(r, "goalID"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"diagnostic": attempt})
}

func (s *Server) diagnosticResult(w http.ResponseWriter, r *http.Request) {
	attempt, err := s.store.GetLatestDiagnostic(r.Context(), userID(r), chi.URLParam(r, "goalID"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	if attempt.Status != "evaluated" {
		writeError(w, r, apiError{Status: http.StatusConflict, Code: "evaluation_pending", Message: "The diagnostic has not been evaluated yet."})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"diagnostic": attempt})
}

func (s *Server) submitDiagnostic(w http.ResponseWriter, r *http.Request) {
	var input domain.SubmitDiagnosticInput
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	if _, err := uuid.Parse(strings.TrimSpace(input.AttemptID)); err != nil {
		writeValidation(w, r, []string{"attempt_id must be a UUID"})
		return
	}
	goalID := chi.URLParam(r, "goalID")
	attempt, keys, err := s.store.GetDiagnosticForEvaluation(r.Context(), userID(r), goalID, input.AttemptID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if attempt.Status == "evaluated" {
		writeJSON(w, http.StatusOK, map[string]any{"diagnostic": attempt})
		return
	}

	if attempt.Status == "ready" {
		answers := make([]domain.DiagnosticAnswer, 0, len(input.Answers))
		for _, answer := range input.Answers {
			answers = append(answers, domain.DiagnosticAnswer{
				QuestionID: answer.QuestionID,
				Response:   answer.Response,
			})
		}
		questionIDs := make(map[string]bool, len(attempt.Questions))
		for _, question := range attempt.Questions {
			questionIDs[question.ID] = true
		}
		if problems := validate.Answers(answers, questionIDs); len(problems) > 0 {
			writeValidation(w, r, problems)
			return
		}
		attempt, err = s.store.SubmitDiagnosticAnswers(r.Context(), userID(r), goalID, input.AttemptID, answers)
		if err != nil {
			logServerError(r, err)
			writeError(w, r, err)
			return
		}
	} else if attempt.Status != "submitted" {
		writeError(w, r, store.ErrConflict)
		return
	}

	ai, ok := s.requireAI(w, r)
	if !ok {
		return
	}
	answers := make([]domain.DiagnosticAnswer, 0, len(attempt.Answers))
	answers = append(answers, attempt.Answers...)
	questions := make([]aiclient.AIQuestion, 0, len(attempt.Questions))
	for _, question := range attempt.Questions {
		questions = append(questions, aiclient.AIQuestion{
			ID:          question.ID,
			Sequence:    question.Sequence,
			Type:        question.Type,
			Prompt:      question.Prompt,
			Competency:  question.Competency,
			Difficulty:  question.Difficulty,
			Choices:     question.Choices,
			Explanation: question.Explanation,
		})
	}
	goal, err := s.store.GetLearningGoal(r.Context(), userID(r), goalID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	response, err := ai.EvaluateDiagnostic(ctx, aiclient.DiagnosticEvaluateRequest{
		LearningGoal: goalContext(goal),
		Questions:    questions,
		AnswerKeys:   keys,
		Answers:      answers,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	updated, err := s.store.SaveDiagnosticEvaluation(r.Context(), userID(r), goalID, input.AttemptID, response.Evaluation, nil)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"diagnostic": updated})
}

func (s *Server) generateCourse(w http.ResponseWriter, r *http.Request) {
	var input domain.GenerateCourseInput
	if r.ContentLength > 0 {
		if err := decodeJSON(w, r, &input); err != nil {
			writeError(w, r, err)
			return
		}
	}
	input.LearnerCorrections = strings.TrimSpace(input.LearnerCorrections)
	if len([]rune(input.LearnerCorrections)) > 3000 {
		writeValidation(w, r, []string{"learner_corrections must be at most 3000 characters"})
		return
	}
	goalID := chi.URLParam(r, "goalID")
	detail, err := s.runGeneration(r, goalID, input.LearnerCorrections, "", "")
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"course": detail})
}

func (s *Server) regenerateCourse(w http.ResponseWriter, r *http.Request) {
	var input domain.RegenerateCourseInput
	if r.ContentLength > 0 {
		if err := decodeJSON(w, r, &input); err != nil {
			writeError(w, r, err)
			return
		}
	}
	input.Instructions = strings.TrimSpace(input.Instructions)
	if len([]rune(input.Instructions)) > 2000 {
		writeValidation(w, r, []string{"instructions must be at most 2000 characters"})
		return
	}
	courseID := chi.URLParam(r, "courseID")
	course, err := s.store.GetCourse(r.Context(), userID(r), courseID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if course.Version == nil {
		writeError(w, r, store.ErrInvalidState)
		return
	}
	previous := summarizeVersion(course.Version)
	detail, err := s.runGeneration(r, course.LearningGoalID, "", input.Instructions, previous)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"course": detail})
}

func (s *Server) runGeneration(r *http.Request, goalID, corrections, additional, previous string) (*domain.CourseDetail, error) {
	if s.ai == nil || !s.ai.Configured() {
		return nil, aiclient.ErrNotConfigured
	}
	ai := s.ai
	goal, err := s.store.GetLearningGoal(r.Context(), userID(r), goalID)
	if err != nil {
		return nil, err
	}
	diagnostic, err := s.store.GetLatestDiagnostic(r.Context(), userID(r), goalID)
	if err != nil {
		return nil, err
	}
	if diagnostic.Status != "evaluated" {
		return nil, apiError{Status: http.StatusConflict, Code: "diagnostic_required", Message: "Complete the diagnostic before generating a curriculum."}
	}
	if _, started, err := s.store.BeginGeneration(r.Context(), userID(r), goalID, s.cfg.GenerationStaleAfter); err != nil {
		return nil, err
	} else if !started {
		return nil, store.ErrGenerationInProgress
	}

	ctx, cancel := generationContext(r, s.cfg.AIGenerationTimeout)
	defer cancel()
	response, err := ai.GenerateCourse(ctx, aiclient.CurriculumGenerateRequest{
		LearningGoal:           goalContext(goal),
		Diagnostic:             diagnosticContext(diagnostic),
		LearnerCorrections:     corrections,
		AdditionalInstructions: trimTo(additional, 2000),
		PreviousVersionSummary: trimTo(previous, 4000),
	})
	if err != nil {
		s.markGoalFailed(r, goalID, err)
		return nil, err
	}
	if problems := validate.Curriculum(response.Course); len(problems) > 0 {
		s.markGoalFailed(r, goalID, errors.New("generated curriculum failed validation"))
		return nil, apiError{
			Status:  http.StatusUnprocessableEntity,
			Code:    "invalid_generated_content",
			Message: "The generated curriculum did not pass structural validation. You can retry.",
			Details: map[string]any{"errors": limitStrings(problems, 20)},
		}
	}
	detail, err := s.store.CreateCourseVersion(r.Context(), userID(r), goalID, response.Course, response.Warnings, response.Metadata)
	if err != nil {
		s.markGoalFailed(r, goalID, err)
		return nil, err
	}
	return detail, nil
}

func (s *Server) listCourses(w http.ResponseWriter, r *http.Request) {
	courses, err := s.store.ListCourses(r.Context(), userID(r))
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"courses": courses})
}

func (s *Server) getCourse(w http.ResponseWriter, r *http.Request) {
	course, err := s.store.GetCourse(r.Context(), userID(r), chi.URLParam(r, "courseID"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": course})
}

func (s *Server) updateDraft(w http.ResponseWriter, r *http.Request) {
	var patch domain.UpdateDraftInput
	if err := decodeJSON(w, r, &patch); err != nil {
		writeError(w, r, err)
		return
	}
	if problems := validate.DraftPatch(&patch); len(problems) > 0 {
		writeValidation(w, r, problems)
		return
	}
	course, err := s.store.UpdateDraft(r.Context(), userID(r), chi.URLParam(r, "courseID"), patch)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": course})
}

func (s *Server) approveCourse(w http.ResponseWriter, r *http.Request) {
	var input domain.ApproveCourseInput
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	if _, err := uuid.Parse(strings.TrimSpace(input.VersionID)); err != nil {
		writeValidation(w, r, []string{"version_id must be a UUID"})
		return
	}
	course, err := s.store.ApproveCourse(r.Context(), userID(r), chi.URLParam(r, "courseID"), input.VersionID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"course": course})
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func (s *Server) requireAI(w http.ResponseWriter, r *http.Request) (*aiclient.Client, bool) {
	if s.ai == nil || !s.ai.Configured() {
		writeError(w, r, aiclient.ErrNotConfigured)
		return nil, false
	}
	return s.ai, true
}

func generationContext(r *http.Request, timeout time.Duration) (context.Context, context.CancelFunc) {
	// Detach from the client connection so a refresh does not abort a generation
	// that the database lock already considers to be running.
	ctx := context.WithoutCancel(r.Context())
	if requestID := middleware.GetReqID(r.Context()); requestID != "" {
		ctx = aiclient.WithRequestID(ctx, requestID)
	}
	return context.WithTimeout(ctx, timeout)
}

func (s *Server) markGoalFailed(r *http.Request, goalID string, cause error) {
	message := "Generation failed. You can retry."
	switch {
	case errors.Is(cause, aiclient.ErrTimeout):
		message = "Generation timed out. You can retry."
	case errors.Is(cause, aiclient.ErrRateLimited):
		message = "The AI provider is rate limiting requests. Try again shortly."
	case errors.Is(cause, aiclient.ErrInvalid):
		message = "The AI response did not pass validation. You can retry."
	case errors.Is(cause, aiclient.ErrUnavailable), errors.Is(cause, aiclient.ErrNotConfigured):
		message = "The AI service is unavailable. You can retry."
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
	defer cancel()

	// A failed regeneration must not hide a course that still exists. Keep the
	// goal aligned with the persisted course so the review page remains usable.
	status := "failed"
	var lastError *string = &message
	if courses, err := s.store.ListCourses(ctx, userID(r)); err == nil {
		for _, course := range courses {
			if course.LearningGoalID != goalID {
				continue
			}
			if course.HasDraft {
				status = "course_draft"
			} else if course.ApprovedVersionID != nil {
				status = "approved"
			}
			if status != "failed" {
				lastError = nil
			}
			break
		}
	}
	if err := s.store.SetGoalStatus(ctx, userID(r), goalID, status, lastError); err != nil {
		logServerError(r, err)
	}
}

func goalContext(goal *domain.LearningGoal) aiclient.GoalContext {
	return aiclient.GoalContext{
		Title:               goal.Title,
		GoalStatement:       goal.GoalStatement,
		IntendedOutcome:     goal.IntendedOutcome,
		Motivation:          goal.Motivation,
		AdditionalContext:   goal.AdditionalContext,
		SelfReportedLevel:   goal.SelfReportedLevel,
		CurrentKnowledge:    goal.CurrentKnowledge,
		WeeklyStudyMinutes:  goal.WeeklyStudyMinutes,
		LearningLanguage:    goal.LearningLanguage,
		LearningPreferences: goal.LearningPreferences,
		TargetDate:          goal.TargetDate,
	}
}

func diagnosticContext(attempt *domain.DiagnosticAttempt) aiclient.DiagnosticContext {
	confidence := "medium"
	if attempt.Confidence != nil {
		confidence = *attempt.Confidence
	}
	return aiclient.DiagnosticContext{
		EstimatedLevel:   deref(attempt.EstimatedLevel, "beginner"),
		Confidence:       confidence,
		Summary:          deref(attempt.Summary, "The diagnostic did not produce a summary."),
		Strengths:        attempt.Strengths,
		Gaps:             attempt.KnowledgeGaps,
		RecommendedStart: deref(attempt.RecommendedStart, "Start with the foundations."),
		Rationale:        deref(attempt.Rationale, "Based on the diagnostic answers."),
	}
}

func summarizeVersion(version *domain.CourseVersion) string {
	var builder strings.Builder
	builder.WriteString("Previous version: ")
	builder.WriteString(version.Title)
	builder.WriteString("\nModules:\n")
	for _, module := range version.Modules {
		builder.WriteString("- ")
		builder.WriteString(module.Title)
		builder.WriteString(fmt.Sprintf(" (%d classes)\n", len(module.Classes)))
	}
	return trimTo(builder.String(), 4000)
}

func writeValidation(w http.ResponseWriter, r *http.Request, problems []string) {
	writeError(w, r, apiError{
		Status:  http.StatusUnprocessableEntity,
		Code:    "validation_failed",
		Message: "Some fields need attention.",
		Details: map[string]any{"errors": problems},
	})
}

func deref(value *string, fallback string) string {
	if value == nil || strings.TrimSpace(*value) == "" {
		return fallback
	}
	return *value
}

func trimTo(value string, limit int) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= limit {
		return string(runes)
	}
	return string(runes[:limit])
}

func limitStrings(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}

func (s *Server) getDashboard(w http.ResponseWriter, r *http.Request) {
	data, err := s.store.GetDashboard(r.Context(), userID(r))
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"dashboard": data})
}

func (s *Server) getProgress(w http.ResponseWriter, r *http.Request) {
	data, err := s.store.GetProgress(r.Context(), userID(r))
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"progress": data})
}

func (s *Server) completeLesson(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	courseID := chi.URLParam(r, "courseID")
	lessonID := chi.URLParam(r, "lessonID")
	if courseID == "" || lessonID == "" {
		writeError(w, r, apiError{Status: http.StatusBadRequest, Code: "invalid_request", Message: "courseID and lessonID are required."})
		return
	}
	if err := s.store.CompleteLesson(r.Context(), uid, courseID, lessonID); err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"completed": true, "lesson_id": lessonID})
}

func (s *Server) getCompletedLessons(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	courseID := chi.URLParam(r, "courseID")
	lessons, err := s.store.GetCompletedLessons(r.Context(), uid, courseID)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"completed_lesson_ids": lessons})
}

func (s *Server) createConversation(w http.ResponseWriter, r *http.Request) {
	var input domain.CreateConversationInput
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	conv, err := s.store.CreateConversation(r.Context(), userID(r), input)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"conversation": conv})
}

func (s *Server) listConversations(w http.ResponseWriter, r *http.Request) {
	convs, err := s.store.ListConversations(r.Context(), userID(r))
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversations": convs})
}

func (s *Server) getConversation(w http.ResponseWriter, r *http.Request) {
	convID := chi.URLParam(r, "conversationID")
	detail, err := s.store.GetConversation(r.Context(), userID(r), convID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, r, apiError{Status: http.StatusNotFound, Code: "not_found", Message: "Conversation not found."})
			return
		}
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": detail})
}

func (s *Server) updateConversation(w http.ResponseWriter, r *http.Request) {
	convID := chi.URLParam(r, "conversationID")
	var input domain.UpdateConversationInput
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	conv, err := s.store.UpdateConversation(r.Context(), userID(r), convID, input)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, r, apiError{Status: http.StatusNotFound, Code: "not_found", Message: "Conversation not found."})
			return
		}
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"conversation": conv})
}

func (s *Server) deleteConversation(w http.ResponseWriter, r *http.Request) {
	convID := chi.URLParam(r, "conversationID")
	if err := s.store.DeleteConversation(r.Context(), userID(r), convID); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, r, apiError{Status: http.StatusNotFound, Code: "not_found", Message: "Conversation not found."})
			return
		}
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
}

func (s *Server) sendMessage(w http.ResponseWriter, r *http.Request) {
	uid := userID(r)
	convID := chi.URLParam(r, "conversationID")

	conv, err := s.store.GetConversation(r.Context(), uid, convID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, r, apiError{Status: http.StatusNotFound, Code: "not_found", Message: "Conversation not found."})
			return
		}
		logServerError(r, err)
		writeError(w, r, err)
		return
	}

	var input domain.CreateMessageInput
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	content := strings.TrimSpace(input.Content)
	if content == "" {
		writeError(w, r, apiError{Status: http.StatusBadRequest, Code: "empty_message", Message: "Message content cannot be empty."})
		return
	}
	if len(content) > 10000 {
		writeError(w, r, apiError{Status: http.StatusBadRequest, Code: "message_too_long", Message: "Message exceeds maximum length."})
		return
	}

	// 1. Persist the user message
	userMsg, err := s.store.AddMessage(r.Context(), uid, convID, "user", content, "", nil, input.Context)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}

	// 2. Prepare message history for AI Engine
	var chatMessages []aiclient.ChatMessage
	for _, m := range conv.Messages {
		chatMessages = append(chatMessages, aiclient.ChatMessage{
			Role:    m.Role,
			Content: m.Content,
		})
	}
	chatMessages = append(chatMessages, aiclient.ChatMessage{
		Role:    "user",
		Content: content,
	})
	// The AI Engine accepts at most 50 messages; keep the most recent window.
	if len(chatMessages) > 50 {
		chatMessages = chatMessages[len(chatMessages)-50:]
	}

	// 3. Build chat context
	var chatCtx *aiclient.ChatContext
	if input.Context != nil {
		chatCtx = &aiclient.ChatContext{}
		if courseTitle, ok := input.Context["course_title"].(string); ok {
			chatCtx.CourseTitle = courseTitle
		}
		if lessonTitle, ok := input.Context["lesson_title"].(string); ok {
			chatCtx.LessonTitle = lessonTitle
		}
		if moduleTitle, ok := input.Context["module_title"].(string); ok {
			chatCtx.ModuleTitle = moduleTitle
		}
		if classTitle, ok := input.Context["class_title"].(string); ok {
			chatCtx.ClassTitle = classTitle
		}
		if level, ok := input.Context["user_level"].(string); ok {
			chatCtx.UserLevel = level
		}
	}

	// 4. Call AI Engine
	// The AI Engine expects snake_case mode ids ("deep_dive"); conversations may store
	// the hyphenated UI id ("deep-dive"). An empty mode falls back to the default.
	mode := strings.ReplaceAll(conv.TutorMode, "-", "_")
	if mode == "" {
		mode = "explain"
	}
	chatReq := aiclient.ChatRequest{
		Mode:     mode,
		Messages: chatMessages,
		Context:  chatCtx,
	}

	aiResp, err := s.ai.Chat(r.Context(), chatReq)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}

	if aiResp.Data == nil {
		writeError(w, r, apiError{Status: http.StatusInternalServerError, Code: "ai_error", Message: "No response from AI Tutor."})
		return
	}

	// 5. Persist assistant message
	meta := map[string]any{
		"provider":      aiResp.Data.Provider,
		"fallback_used": aiResp.Data.FallbackUsed,
		"duration_ms":   aiResp.Data.DurationMS,
	}
	assistantMsg, err := s.store.AddMessage(
		r.Context(), uid, convID, "assistant",
		aiResp.Data.Text, aiResp.Data.Model, aiResp.Data.Usage, meta,
	)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user_message":      userMsg,
		"assistant_message": assistantMsg,
	})
}
