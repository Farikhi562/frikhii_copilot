package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/frikhii/copilot/core-api/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

func (s *Server) getRoadmap(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	roadmap, err := s.store.GetRoadmap(r.Context(), userID(r), courseID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"roadmap": roadmap})
}

// ---------------------------------------------------------------------------
// Lesson playback
// ---------------------------------------------------------------------------

func (s *Server) getLesson(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	lessonID := chi.URLParam(r, "lessonID")

	lesson, err := s.store.GetLesson(r.Context(), userID(r), courseID, lessonID)
	if err != nil {
		writeError(w, r, err)
		return
	}

	// If there is no authored content yet, generate it inline.
	hasAuthored := false
	for _, content := range lesson.Contents {
		if content.ContentType == "authored" {
			hasAuthored = true
			break
		}
	}
	if !hasAuthored {
		ai, ok := s.requireAI(w, r)
		if !ok {
			return
		}
		// Extract blueprint from the blueprint content block.
		var blueprintRaw map[string]any
		for _, content := range lesson.Contents {
			if content.ContentType == "blueprint" {
				_ = json.Unmarshal(content.Content, &blueprintRaw)
				break
			}
		}
		course, err := s.store.GetCourse(r.Context(), userID(r), courseID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		className := ""
		if course.Version != nil {
			for _, mod := range course.Version.Modules {
				for _, cls := range mod.Classes {
					for _, l := range cls.Lessons {
						if l.ID == lesson.ID {
							className = cls.Title
						}
					}
				}
			}
		}
		courseTitle := ""
		if course.Version != nil {
			courseTitle = course.Version.Title
		}
		language := "en-US"
		level := "beginner"
		if course.Version != nil {
			level = course.Version.TargetLearnerLevel
		}

		ctx, cancel := generationContext(r, s.cfg.AITimeout)
		defer cancel()
		if requestID := middleware.GetReqID(r.Context()); requestID != "" {
			ctx = aiclient.WithRequestID(ctx, requestID)
		}
		generated, err := ai.GenerateLesson(ctx, aiclient.LessonGenerateRequest{
			LessonID:         lesson.SourceID,
			Title:            lesson.Title,
			Description:      lesson.Description,
			Blueprint:        blueprintRaw,
			CourseTitle:      courseTitle,
			ClassTitle:       className,
			LearningLanguage: language,
			LearnerLevel:     level,
		})
		if err != nil {
			// Return blueprint-only data if generation fails — don't block the learner.
			logServerError(r, err)
			writeJSON(w, http.StatusOK, map[string]any{"lesson": lesson, "authored": nil, "generation_error": err.Error()})
			return
		}
		// Persist the authored content so we don't regenerate on the next load.
		if saveErr := s.store.SaveLessonAuthored(r.Context(), userID(r), courseID, lesson.ID, generated.Lesson); saveErr != nil {
			logServerError(r, saveErr)
		}
		writeJSON(w, http.StatusOK, map[string]any{"lesson": lesson, "authored": generated.Lesson})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"lesson": lesson, "authored": nil})
}

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

func (s *Server) getExercise(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	classID := chi.URLParam(r, "classID")

	exercise, err := s.store.GetExercise(r.Context(), userID(r), courseID, classID)
	if err != nil {
		writeError(w, r, err)
		return
	}

	// If no authored exercise exists yet, generate it.
	if exercise.AuthoredContent == nil {
		ai, ok := s.requireAI(w, r)
		if !ok {
			return
		}
		course, err := s.store.GetCourse(r.Context(), userID(r), courseID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		courseTitle := ""
		className := ""
		language := "en-US"
		level := "beginner"
		if course.Version != nil {
			courseTitle = course.Version.Title
			level = course.Version.TargetLearnerLevel
			for _, mod := range course.Version.Modules {
				for _, cls := range mod.Classes {
					if cls.ID == classID {
						className = cls.Title
					}
				}
			}
		}
		ctx, cancel := generationContext(r, s.cfg.AITimeout)
		defer cancel()
		generated, err := ai.GenerateExercise(ctx, aiclient.ExerciseGenerateRequest{
			ClassID:             classID,
			ClassTitle:          className,
			ExerciseTitle:       exercise.Title,
			ExerciseDescription: exercise.Description,
			Difficulty:          exercise.Difficulty,
			Competency:          exercise.Competency,
			CourseTitle:         courseTitle,
			LearningLanguage:    language,
			LearnerLevel:        level,
		})
		if err != nil {
			logServerError(r, err)
			writeJSON(w, http.StatusOK, map[string]any{"exercise": exercise, "authored": nil, "generation_error": err.Error()})
			return
		}
		if saveErr := s.store.SaveExerciseAuthored(r.Context(), userID(r), courseID, exercise.ID, generated.Exercise); saveErr != nil {
			logServerError(r, saveErr)
		}
		writeJSON(w, http.StatusOK, map[string]any{"exercise": exercise, "authored": generated.Exercise})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"exercise": exercise, "authored": exercise.AuthoredContent})
}

func (s *Server) submitExercise(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	classID := chi.URLParam(r, "classID")

	var input struct {
		Response string `json:"response"`
	}
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	input.Response = strings.TrimSpace(input.Response)
	if len([]rune(input.Response)) < 10 {
		writeValidation(w, r, []string{"response must be at least 10 characters"})
		return
	}
	if len([]rune(input.Response)) > 10000 {
		writeValidation(w, r, []string{"response must be at most 10000 characters"})
		return
	}

	exercise, err := s.store.GetExercise(r.Context(), userID(r), courseID, classID)
	if err != nil {
		writeError(w, r, err)
		return
	}

	submission, err := s.store.SubmitExercise(r.Context(), userID(r), courseID, exercise.ID, input.Response)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"submission": submission})
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

func (s *Server) startQuiz(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	classID := chi.URLParam(r, "classID")

	// Return existing ready/submitted attempt if one exists.
	existing, err := s.store.GetLatestQuiz(r.Context(), userID(r), courseID, classID)
	if err == nil {
		switch existing.Status {
		case "ready":
			writeJSON(w, http.StatusOK, map[string]any{"quiz": existing})
			return
		case "evaluated":
			// Allow starting a new attempt even if one is evaluated.
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

	course, err := s.store.GetCourse(r.Context(), userID(r), courseID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if course.Version == nil {
		writeError(w, r, apiError{Status: http.StatusConflict, Code: "no_version", Message: "The course has no active version."})
		return
	}

	// Find the class within the approved/current version.
	var targetClass *domain.CourseClass
	for i := range course.Version.Modules {
		for j := range course.Version.Modules[i].Classes {
			if course.Version.Modules[i].Classes[j].ID == classID {
				targetClass = &course.Version.Modules[i].Classes[j]
				break
			}
		}
		if targetClass != nil {
			break
		}
	}
	if targetClass == nil {
		writeError(w, r, apiError{Status: http.StatusNotFound, Code: "class_not_found", Message: "Class not found in the current course version."})
		return
	}

	competencies := make([]string, 0, len(targetClass.Objectives))
	for _, obj := range targetClass.Objectives {
		competencies = append(competencies, obj.Competency)
	}

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	questionCount := targetClass.KnowledgeCheck.QuestionCount
	if questionCount < 3 {
		questionCount = 5
	}
	generated, err := ai.GenerateQuiz(ctx, aiclient.QuizGenerateRequest{
		ClassID:                   classID,
		ClassTitle:                targetClass.Title,
		ClassDescription:          targetClass.Description,
		Competencies:              competencies,
		KnowledgeCheckDescription: targetClass.KnowledgeCheck.Description,
		QuestionCount:             questionCount,
		CourseTitle:               course.Version.Title,
		LearningLanguage:          "en-US",
		LearnerLevel:              course.Version.TargetLearnerLevel,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}

	// Convert AI questions to store questions.
	questions := make([]store.QuizQuestion, 0, len(generated.Questions))
	for _, q := range generated.Questions {
		choices := make([]domain.Choice, 0, len(q.Choices))
		for _, c := range q.Choices {
			choices = append(choices, domain.Choice{ID: c.ID, Text: c.Text})
		}
		questions = append(questions, store.QuizQuestion{
			SourceID:   q.ID,
			Sequence:   q.Sequence,
			Type:       q.Type,
			Prompt:     q.Prompt,
			Competency: q.Competency,
			Difficulty: q.Difficulty,
			Choices:    choices,
		})
	}
	keys := make([]domain.QuizAnswerKey, 0, len(generated.AnswerKeys))
	for _, k := range generated.AnswerKeys {
		rubric := make([]domain.RubricCriterion, 0, len(k.Rubric))
		for _, rc := range k.Rubric {
			rubric = append(rubric, domain.RubricCriterion{
				Criterion:   rc.Criterion,
				Description: rc.Description,
				Weight:      rc.Weight,
			})
		}
		keys = append(keys, domain.QuizAnswerKey{
			QuestionID:     k.QuestionID,
			ExpectedAnswer: k.ExpectedAnswer,
			Rubric:         rubric,
		})
	}

	attempt, err := s.store.CreateQuizAttempt(r.Context(), userID(r), courseID, classID, generated.PassingScore, questions, keys)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"quiz": attempt})
}

func (s *Server) getLatestQuiz(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	classID := chi.URLParam(r, "classID")

	attempt, err := s.store.GetLatestQuiz(r.Context(), userID(r), courseID, classID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"quiz": attempt})
}

func (s *Server) submitQuiz(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	classID := chi.URLParam(r, "classID")

	var input struct {
		AttemptID string               `json:"attempt_id"`
		Answers   []domain.QuizAnswer  `json:"answers"`
	}
	if err := decodeJSON(w, r, &input); err != nil {
		writeError(w, r, err)
		return
	}
	input.AttemptID = strings.TrimSpace(input.AttemptID)
	if input.AttemptID == "" {
		writeValidation(w, r, []string{"attempt_id is required"})
		return
	}
	if len(input.Answers) == 0 {
		writeValidation(w, r, []string{"answers must not be empty"})
		return
	}

	attempt, keys, err := s.store.GetQuizForEvaluation(r.Context(), userID(r), input.AttemptID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if attempt.Status == "evaluated" {
		writeJSON(w, http.StatusOK, map[string]any{"quiz": attempt})
		return
	}
	if attempt.Status != "ready" {
		writeError(w, r, store.ErrConflict)
		return
	}

	ai, ok := s.requireAI(w, r)
	if !ok {
		return
	}

	// Build answer list — only accept question IDs that exist.
	qIDs := make(map[string]domain.QuizQuestion, len(attempt.Questions))
	for _, q := range attempt.Questions {
		qIDs[q.ID] = q
	}
	aiAnswers := make([]domain.QuizAnswer, 0, len(input.Answers))
	for _, a := range input.Answers {
		if _, ok := qIDs[a.QuestionID]; !ok {
			continue
		}
		aiAnswers = append(aiAnswers, domain.QuizAnswer{
			QuestionID: a.QuestionID,
			Response:   strings.TrimSpace(a.Response),
		})
	}

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	_ = time.Now() // ensure time import is used

	course, err := s.store.GetCourse(r.Context(), userID(r), courseID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	classTitle := classID
	if course.Version != nil {
		for _, mod := range course.Version.Modules {
			for _, cls := range mod.Classes {
				if cls.ID == classID {
					classTitle = cls.Title
				}
			}
		}
	}

	response, err := ai.EvaluateQuiz(ctx, aiclient.QuizEvaluateRequest{
		ClassID:      classID,
		ClassTitle:   classTitle,
		Questions:    attempt.Questions,
		AnswerKeys:   keys,
		Answers:      aiAnswers,
		PassingScore: attempt.PassingScore,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}

	updated, err := s.store.SaveQuizEvaluation(r.Context(), userID(r), input.AttemptID, aiAnswers, response.Evaluation)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"quiz": updated})
}

// ---------------------------------------------------------------------------
// Remedial
// ---------------------------------------------------------------------------

func (s *Server) getRemedialPlan(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	classID := chi.URLParam(r, "classID")

	plan, err := s.store.GetLatestRemedialPlan(r.Context(), userID(r), courseID, classID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"remedial_plan": plan})
}

func (s *Server) generateRemedialPlan(w http.ResponseWriter, r *http.Request) {
	courseID := chi.URLParam(r, "courseID")
	classID := chi.URLParam(r, "classID")

	// Require an evaluated quiz that did not pass.
	quiz, err := s.store.GetLatestQuiz(r.Context(), userID(r), courseID, classID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if quiz.Status != "evaluated" {
		writeError(w, r, apiError{
			Status:  http.StatusConflict,
			Code:    "quiz_not_evaluated",
			Message: "Complete the quiz before generating a remedial plan.",
		})
		return
	}

	ai, ok := s.requireAI(w, r)
	if !ok {
		return
	}

	course, err := s.store.GetCourse(r.Context(), userID(r), courseID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	courseTitle := ""
	classTitle := classID
	language := "en-US"
	level := "beginner"
	weeklyMinutes := 300
	if course.Version != nil {
		courseTitle = course.Version.Title
		level = course.Version.TargetLearnerLevel
		for _, mod := range course.Version.Modules {
			for _, cls := range mod.Classes {
				if cls.ID == classID {
					classTitle = cls.Title
				}
			}
		}
	}

	// Build gap list from quiz evaluation.
	gaps := make([]domain.KnowledgeGap, 0, len(quiz.Gaps))
	gaps = append(gaps, quiz.Gaps...)

	strengths := make([]string, 0, len(quiz.Strengths))
	strengths = append(strengths, quiz.Strengths...)

	score := 0
	if quiz.Score != nil {
		score = *quiz.Score
	}

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	generated, err := ai.GenerateRemedial(ctx, aiclient.RemedialGenerateRequest{
		ClassID:            classID,
		ClassTitle:         classTitle,
		CourseTitle:        courseTitle,
		QuizScore:          score,
		PassingScore:       quiz.PassingScore,
		Gaps:               gaps,
		Strengths:          strengths,
		LearningLanguage:   language,
		LearnerLevel:       level,
		WeeklyStudyMinutes: weeklyMinutes,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}

	savedPlan, err := s.store.CreateRemedialPlan(r.Context(), userID(r), courseID, classID, quiz.ID, generated.Plan)
	if err != nil {
		logServerError(r, err)
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"remedial_plan": savedPlan})
}
