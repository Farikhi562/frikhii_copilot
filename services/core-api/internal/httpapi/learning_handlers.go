package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/frikhii/copilot/core-api/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

// normalizeLearnerLevel maps the intake and course vocabulary onto the AI
// Engine's Difficulty enum. "basic" and "unsure" are not valid there, so they
// fall back to the closest safe level.
func normalizeLearnerLevel(level string) string {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "intermediate":
		return "intermediate"
	case "advanced":
		return "advanced"
	default:
		return "foundation"
	}
}

func shortText(value, fallback string, min int) string {
	value = strings.TrimSpace(value)
	if len([]rune(value)) < min {
		return fallback
	}
	return value
}

// courseLanguage returns the language chosen on the learning goal so generated
// lessons, quizzes and remedial plans follow the learner's setting.
func (s *Server) courseLanguage(ctx context.Context, userID, courseID string) string {
	course, err := s.store.GetCourse(ctx, userID, courseID)
	if err != nil || course.LearningGoalID == "" {
		return "en-US"
	}
	goal, err := s.store.GetLearningGoal(ctx, userID, course.LearningGoalID)
	if err != nil || strings.TrimSpace(goal.LearningLanguage) == "" {
		return "en-US"
	}
	return goal.LearningLanguage
}

func (s *Server) classUnlocked(ctx context.Context, userID, courseID, classID string) (bool, error) {
	roadmap, err := s.store.GetRoadmap(ctx, userID, courseID)
	if err != nil {
		return false, err
	}
	for _, module := range roadmap.Modules {
		for _, class := range module.Classes {
			if class.ID == classID {
				return class.Unlocked, nil
			}
		}
	}
	return false, store.ErrNotFound
}

// requireUnlockedClass writes a 403 when a learner tries to open content before
// passing the previous class. This is enforced server-side, not just hidden in
// the UI.
func (s *Server) requireUnlockedClass(w http.ResponseWriter, r *http.Request, courseID, classID string) bool {
	unlocked, err := s.classUnlocked(r.Context(), userID(r), courseID, classID)
	if err != nil {
		writeError(w, r, err)
		return false
	}
	if !unlocked {
		writeError(w, r, apiError{
			Status:  http.StatusForbidden,
			Code:    "class_locked",
			Message: "Pass the previous class assessment to unlock this class.",
		})
		return false
	}
	return true
}

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
	if !s.requireUnlockedClass(w, r, courseID, lesson.ClassID) {
		return
	}

	// Extract the blueprint and any previously authored content.
	var blueprintRaw map[string]any
	var authored json.RawMessage
	for _, content := range lesson.Contents {
		switch content.ContentType {
		case "blueprint":
			_ = json.Unmarshal(content.Content, &blueprintRaw)
		case "authored":
			authored = content.Content
		}
	}
	if len(authored) > 0 && string(authored) != "null" {
		writeJSON(w, http.StatusOK, map[string]any{"lesson": lesson, "authored": authored})
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
	level := "foundation"
	if course.Version != nil {
		courseTitle = course.Version.Title
		level = normalizeLearnerLevel(course.Version.TargetLearnerLevel)
	}
	language := s.courseLanguage(r.Context(), userID(r), courseID)

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	if requestID := middleware.GetReqID(r.Context()); requestID != "" {
		ctx = aiclient.WithRequestID(ctx, requestID)
	}
	generated, err := ai.GenerateLesson(ctx, aiclient.LessonGenerateRequest{
		LessonID:         lesson.SourceID,
		Title:            shortText(lesson.Title, "Lesson", 2),
		Description:      shortText(lesson.Description, "A focused lesson.", 3),
		Blueprint:        blueprintRaw,
		CourseTitle:      shortText(courseTitle, "Course", 2),
		ClassTitle:       shortText(className, "Class", 2),
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
	if !s.requireUnlockedClass(w, r, courseID, classID) {
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
		level := "foundation"
		if course.Version != nil {
			courseTitle = course.Version.Title
			level = normalizeLearnerLevel(course.Version.TargetLearnerLevel)
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
			ClassTitle:          shortText(className, "Class", 2),
			ExerciseTitle:       shortText(exercise.Title, "Practice task", 2),
			ExerciseDescription: shortText(exercise.Description, "Apply the class concepts to a small task.", 3),
			Difficulty:          normalizeLearnerLevel(exercise.Difficulty),
			Competency:          shortText(exercise.Competency, "Applied understanding", 2),
			CourseTitle:         shortText(courseTitle, "Course", 2),
			LearningLanguage:    s.courseLanguage(r.Context(), userID(r), courseID),
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
	if !s.requireUnlockedClass(w, r, courseID, classID) {
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

	if !s.requireUnlockedClass(w, r, courseID, classID) {
		return
	}

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
		if competency := strings.TrimSpace(obj.Competency); competency != "" {
			competencies = append(competencies, competency)
		}
	}
	if len(competencies) == 0 {
		competencies = []string{"Applied understanding"}
	}

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	questionCount := targetClass.KnowledgeCheck.QuestionCount
	if questionCount < 3 {
		questionCount = 5
	}
	generated, err := ai.GenerateQuiz(ctx, aiclient.QuizGenerateRequest{
		ClassID:                   classID,
		ClassTitle:                shortText(targetClass.Title, "Class", 2),
		ClassDescription:          shortText(targetClass.Description, "A practical class with explanation and practice.", 3),
		Competencies:              competencies,
		KnowledgeCheckDescription: shortText(targetClass.KnowledgeCheck.Description, "A short check of the class concepts.", 3),
		QuestionCount:             questionCount,
		CourseTitle:               shortText(course.Version.Title, "Course", 2),
		LearningLanguage:          s.courseLanguage(r.Context(), userID(r), courseID),
		LearnerLevel:              normalizeLearnerLevel(course.Version.TargetLearnerLevel),
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	if generated.PassingScore < 50 || generated.PassingScore > 100 {
		generated.PassingScore = 80
	}
	if len(generated.Questions) < 3 {
		writeError(w, r, apiError{Status: http.StatusBadGateway, Code: "invalid_quiz", Message: "The assessment did not contain enough questions."})
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
	if attempt.CourseID != courseID || attempt.ClassID != classID {
		writeError(w, r, store.ErrNotFound)
		return
	}
	if !s.requireUnlockedClass(w, r, attempt.CourseID, attempt.ClassID) {
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

	// Every question must be answered exactly once. The AI evaluator validates
	// this too; rejecting here avoids a round-trip and gives a clear error.
	qIDs := make(map[string]domain.QuizQuestion, len(attempt.Questions))
	for _, q := range attempt.Questions {
		qIDs[q.ID] = q
	}
	seen := make(map[string]bool, len(input.Answers))
	aiAnswers := make([]domain.QuizAnswer, 0, len(input.Answers))
	for _, a := range input.Answers {
		if _, ok := qIDs[a.QuestionID]; !ok {
			writeValidation(w, r, []string{"answers contain an unknown question_id"})
			return
		}
		if seen[a.QuestionID] {
			writeValidation(w, r, []string{"answers must contain each question exactly once"})
			return
		}
		seen[a.QuestionID] = true
		aiAnswers = append(aiAnswers, domain.QuizAnswer{
			QuestionID: a.QuestionID,
			Response:   strings.TrimSpace(a.Response),
		})
	}
	if len(aiAnswers) != len(attempt.Questions) {
		writeValidation(w, r, []string{"answer every question before submitting"})
		return
	}

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()

	course, err := s.store.GetCourse(r.Context(), userID(r), attempt.CourseID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	classTitle := attempt.ClassID
	if course.Version != nil {
		for _, mod := range course.Version.Modules {
			for _, cls := range mod.Classes {
				if cls.ID == attempt.ClassID {
					classTitle = cls.Title
				}
			}
		}
	}

	passingScore := attempt.PassingScore
	if passingScore < 50 || passingScore > 100 {
		passingScore = 80
	}
	response, err := ai.EvaluateQuiz(ctx, aiclient.QuizEvaluateRequest{
		ClassID:      attempt.ClassID,
		ClassTitle:   shortText(classTitle, "Class", 2),
		Questions:    attempt.Questions,
		AnswerKeys:   keys,
		Answers:      aiAnswers,
		PassingScore: passingScore,
	})
	if err != nil {
		writeError(w, r, err)
		return
	}

	// The AI supplies a score; the server owns the pass/fail rule so a model
	// cannot unlock a class by returning an inconsistent flag.
	evaluation := response.Evaluation
	if evaluation.Score < 0 {
		evaluation.Score = 0
	}
	if evaluation.Score > 100 {
		evaluation.Score = 100
	}
	evaluation.Passed = evaluation.Score >= passingScore
	scored := make(map[string]bool, len(evaluation.QuestionScores))
	for _, score := range evaluation.QuestionScores {
		scored[score.QuestionID] = true
	}
	for id := range qIDs {
		if !scored[id] {
			writeError(w, r, apiError{Status: http.StatusBadGateway, Code: "invalid_evaluation", Message: "The assessment evaluator did not score every question."})
			return
		}
	}

	updated, err := s.store.SaveQuizEvaluation(r.Context(), userID(r), input.AttemptID, aiAnswers, evaluation)
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

	if !s.requireUnlockedClass(w, r, courseID, classID) {
		return
	}

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
	score := 0
	if quiz.Score != nil {
		score = *quiz.Score
	}
	passingScore := quiz.PassingScore
	if passingScore < 50 || passingScore > 100 {
		passingScore = 80
	}
	passed := quiz.Passed != nil && *quiz.Passed
	if quiz.Passed == nil {
		passed = score >= passingScore
	}
	if passed {
		writeError(w, r, apiError{
			Status:  http.StatusConflict,
			Code:    "quiz_passed",
			Message: "This class has already been passed, so a remedial plan is not needed.",
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
	level := "foundation"
	weeklyMinutes := 300
	if course.Version != nil {
		courseTitle = course.Version.Title
		level = normalizeLearnerLevel(course.Version.TargetLearnerLevel)
		for _, mod := range course.Version.Modules {
			for _, cls := range mod.Classes {
				if cls.ID == classID {
					classTitle = cls.Title
				}
			}
		}
	}
	if course.LearningGoalID != "" {
		if goal, goalErr := s.store.GetLearningGoal(r.Context(), userID(r), course.LearningGoalID); goalErr == nil && goal.WeeklyStudyMinutes >= 30 {
			weeklyMinutes = goal.WeeklyStudyMinutes
		}
	}

	// Build gap list from quiz evaluation. The AI contract requires at least one
	// gap; fall back to the assessment score when the evaluator returned none.
	gaps := make([]domain.KnowledgeGap, 0, len(quiz.Gaps))
	gaps = append(gaps, quiz.Gaps...)
	if len(gaps) == 0 {
		gaps = append(gaps, domain.KnowledgeGap{
			Competency:     "Applied understanding",
			Description:    "The assessment score is below the passing threshold, so the class concepts need another pass.",
			Severity:       "medium",
			Recommendation: "Review the class explanation and complete one small task independently before retrying.",
		})
	}

	strengths := make([]string, 0, len(quiz.Strengths))
	strengths = append(strengths, quiz.Strengths...)

	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	ctx, cancel := generationContext(r, s.cfg.AITimeout)
	defer cancel()
	generated, err := ai.GenerateRemedial(ctx, aiclient.RemedialGenerateRequest{
		ClassID:            classID,
		ClassTitle:         shortText(classTitle, "Class", 2),
		CourseTitle:        shortText(courseTitle, "Course", 2),
		QuizScore:          score,
		PassingScore:       passingScore,
		Gaps:               gaps,
		Strengths:          strengths,
		LearningLanguage:   s.courseLanguage(r.Context(), userID(r), courseID),
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
