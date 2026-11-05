package store

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/google/uuid"
)

// Memory is an in-process Store used by tests and local handler development.
// It intentionally mirrors the lifecycle and ownership checks of Postgres so
// HTTP behaviour can be tested without a database.
type Memory struct {
	mu                sync.RWMutex
	goals             map[string]*domain.LearningGoal
	attempts          map[string]*memoryAttempt
	courses           map[string]*memoryCourse
	enrollments       map[string]bool
	conversations     map[string]*domain.Conversation
	messages          map[string][]domain.Message
	lessonCompletions map[string]map[string]bool // userID -> set of lessonIDs
	now               func() time.Time
}

type memoryAttempt struct {
	userID  string
	goalID  string
	attempt domain.DiagnosticAttempt
	keys    map[string]domain.AnswerKey
}

type memoryCourse struct {
	userID     string
	goalID     string
	status     string
	currentID  string
	approvedID string
	versions   map[string]*domain.CourseVersion
	createdAt  time.Time
	updatedAt  time.Time
}

func NewMemory() *Memory {
	return &Memory{
		goals:             map[string]*domain.LearningGoal{},
		attempts:          map[string]*memoryAttempt{},
		courses:           map[string]*memoryCourse{},
		enrollments:       map[string]bool{},
		conversations:     map[string]*domain.Conversation{},
		messages:          map[string][]domain.Message{},
		lessonCompletions: map[string]map[string]bool{},
		now:               time.Now,
	}
}

func (m *Memory) Ping(context.Context) error { return nil }

func (m *Memory) CreateLearningGoal(_ context.Context, userID string, input domain.CreateLearningGoalInput) (*domain.LearningGoal, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now().UTC()
	goal := &domain.LearningGoal{
		ID:                  uuid.NewString(),
		UserID:              userID,
		Title:               input.Title,
		GoalStatement:       input.GoalStatement,
		IntendedOutcome:     input.IntendedOutcome,
		Motivation:          input.Motivation,
		AdditionalContext:   input.AdditionalContext,
		SelfReportedLevel:   input.SelfReportedLevel,
		CurrentKnowledge:    copyMap(input.CurrentKnowledge),
		WeeklyStudyMinutes:  input.WeeklyStudyMinutes,
		LearningLanguage:    input.LearningLanguage,
		LearningPreferences: copyMap(input.LearningPreferences),
		TargetDate:          input.TargetDate,
		Status:              "intake",
		CreatedAt:           now,
		UpdatedAt:           now,
	}
	m.goals[goal.ID] = goal
	return cloneGoal(goal), nil
}

func (m *Memory) ListLearningGoals(_ context.Context, userID string) ([]domain.LearningGoal, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	goals := []domain.LearningGoal{}
	for _, goal := range m.goals {
		if goal.UserID != userID {
			continue
		}
		copy := cloneGoal(goal)
		if course := m.courseForGoalLocked(goal.ID); course != nil {
			id := m.courseIDForLocked(course)
			copy.CourseID = &id
			status := course.status
			copy.CourseStatus = &status
		}
		goals = append(goals, *copy)
	}
	sort.Slice(goals, func(i, j int) bool { return goals[i].UpdatedAt.After(goals[j].UpdatedAt) })
	return goals, nil
}

func (m *Memory) GetLearningGoal(_ context.Context, userID, goalID string) (*domain.LearningGoal, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, ErrNotFound
	}
	copy := cloneGoal(goal)
	if course := m.courseForGoalLocked(goal.ID); course != nil {
		id := m.courseIDForLocked(course)
		copy.CourseID = &id
		status := course.status
		copy.CourseStatus = &status
	}
	return copy, nil
}

func (m *Memory) BeginGeneration(_ context.Context, userID, goalID string, staleAfter time.Duration) (*domain.LearningGoal, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, false, ErrNotFound
	}
	if goal.Status == "generating" && m.now().Sub(goal.UpdatedAt) < staleAfter {
		return nil, false, ErrGenerationInProgress
	}
	switch goal.Status {
	case "diagnostic_evaluated", "course_draft", "failed", "approved", "generating":
	default:
		return nil, false, ErrInvalidState
	}
	goal.Status = "generating"
	goal.LastError = nil
	goal.UpdatedAt = m.now().UTC()
	return cloneGoal(goal), true, nil
}

func (m *Memory) SetGoalStatus(_ context.Context, userID, goalID, status string, lastError *string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return ErrNotFound
	}
	goal.Status = status
	goal.LastError = lastError
	goal.UpdatedAt = m.now().UTC()
	return nil
}

func (m *Memory) CreateDiagnosticAttempt(_ context.Context, userID, goalID string, questions []Question, keys []domain.AnswerKey) (*domain.DiagnosticAttempt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, ErrNotFound
	}
	latest := m.latestAttemptLocked(goalID)
	if latest != nil {
		switch latest.attempt.Status {
		case "ready", "submitted", "evaluating", "evaluated":
			return cloneAttempt(&latest.attempt), nil
		case "generating":
			return nil, ErrGenerationInProgress
		}
	}
	if goal.Status != "intake" && goal.Status != "diagnostic_ready" && goal.Status != "failed" {
		return nil, ErrInvalidState
	}
	number := 1
	if latest != nil {
		number = latest.attempt.AttemptNumber + 1
	}
	now := m.now().UTC()
	attempt := &memoryAttempt{
		userID: userID,
		goalID: goalID,
		attempt: domain.DiagnosticAttempt{
			ID:             uuid.NewString(),
			LearningGoalID: goalID,
			Status:         "ready",
			AttemptNumber:  number,
			Strengths:      []domain.Strength{},
			KnowledgeGaps:  []domain.KnowledgeGap{},
			Misconceptions: []string{},
			QuestionScores: []domain.QuestionScore{},
			CanSkip:        []string{},
			CreatedAt:      now,
		},
		keys: map[string]domain.AnswerKey{},
	}
	for _, key := range keys {
		attempt.keys[key.QuestionID] = key
	}
	for _, question := range questions {
		if _, ok := attempt.keys[question.SourceID]; !ok {
			return nil, ErrInvalidState
		}
		attempt.attempt.Questions = append(attempt.attempt.Questions, domain.DiagnosticQuestion{
			ID:          question.SourceID,
			Sequence:    question.Sequence,
			Type:        question.Type,
			Prompt:      question.Prompt,
			Competency:  question.Competency,
			Difficulty:  question.Difficulty,
			Choices:     append([]domain.Choice(nil), question.Choices...),
			Explanation: question.Explanation,
		})
	}
	m.attempts[attempt.attempt.ID] = attempt
	goal.Status = "diagnostic_ready"
	goal.LastError = nil
	goal.UpdatedAt = now
	return cloneAttempt(&attempt.attempt), nil
}

func (m *Memory) GetLatestDiagnostic(_ context.Context, userID, goalID string) (*domain.DiagnosticAttempt, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, ErrNotFound
	}
	attempt := m.latestAttemptLocked(goalID)
	if attempt == nil {
		return nil, ErrNotFound
	}
	return cloneAttempt(&attempt.attempt), nil
}

func (m *Memory) GetDiagnosticForEvaluation(_ context.Context, userID, goalID, attemptID string) (*domain.DiagnosticAttempt, []domain.AnswerKey, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, nil, ErrNotFound
	}
	attempt, ok := m.attempts[attemptID]
	if !ok || attempt.goalID != goalID {
		return nil, nil, ErrNotFound
	}
	keys := []domain.AnswerKey{}
	for _, key := range attempt.keys {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool { return keys[i].QuestionID < keys[j].QuestionID })
	return cloneAttempt(&attempt.attempt), keys, nil
}

func (m *Memory) SubmitDiagnosticAnswers(_ context.Context, userID, goalID, attemptID string, answers []domain.DiagnosticAnswer) (*domain.DiagnosticAttempt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, ErrNotFound
	}
	attempt, ok := m.attempts[attemptID]
	if !ok || attempt.goalID != goalID {
		return nil, ErrNotFound
	}
	if attempt.attempt.Status != "ready" {
		return nil, ErrConflict
	}
	now := m.now().UTC()
	attempt.attempt.Answers = cloneAnswers(answers)
	attempt.attempt.Status = "submitted"
	attempt.attempt.SubmittedAt = &now
	return cloneAttempt(&attempt.attempt), nil
}

func (m *Memory) SaveDiagnosticEvaluation(_ context.Context, userID, goalID, attemptID string, evaluation domain.DiagnosticEvaluation, _ map[string]any) (*domain.DiagnosticAttempt, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, ErrNotFound
	}
	attempt, ok := m.attempts[attemptID]
	if !ok || attempt.goalID != goalID {
		return nil, ErrNotFound
	}
	if attempt.attempt.Status != "submitted" && attempt.attempt.Status != "evaluating" && attempt.attempt.Status != "evaluated" {
		return nil, ErrConflict
	}
	now := m.now().UTC()
	attempt.attempt.Status = "evaluated"
	attempt.attempt.EstimatedLevel = stringPtr(evaluation.EstimatedLevel)
	attempt.attempt.Confidence = stringPtr(evaluation.Confidence)
	attempt.attempt.Summary = stringPtr(evaluation.Summary)
	attempt.attempt.Strengths = append([]domain.Strength(nil), evaluation.Strengths...)
	attempt.attempt.KnowledgeGaps = append([]domain.KnowledgeGap(nil), evaluation.Gaps...)
	attempt.attempt.Misconceptions = append([]string(nil), evaluation.Misconceptions...)
	attempt.attempt.RecommendedStart = stringPtr(evaluation.RecommendedStart)
	attempt.attempt.Rationale = stringPtr(evaluation.Rationale)
	attempt.attempt.QuestionScores = append([]domain.QuestionScore(nil), evaluation.QuestionScores...)
	attempt.attempt.CanSkip = append([]string(nil), evaluation.CanSkip...)
	attempt.attempt.EvaluatedAt = &now
	for _, score := range evaluation.QuestionScores {
		for index := range attempt.attempt.Answers {
			if attempt.attempt.Answers[index].QuestionID == score.QuestionID {
				value := score.Score
				attempt.attempt.Answers[index].Score = &value
				attempt.attempt.Answers[index].Feedback = score.Feedback
			}
		}
	}
	goal.Status = "diagnostic_evaluated"
	goal.LastError = nil
	goal.UpdatedAt = now
	return cloneAttempt(&attempt.attempt), nil
}

func (m *Memory) CreateCourseVersion(_ context.Context, userID, goalID string, blueprint domain.CourseBlueprint, warnings []string, metadata domain.GenerationMetadata) (*domain.CourseDetail, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	goal, ok := m.goals[goalID]
	if !ok || goal.UserID != userID {
		return nil, ErrNotFound
	}
	switch goal.Status {
	case "generating", "diagnostic_evaluated", "course_draft", "approved", "failed":
	default:
		return nil, ErrInvalidState
	}
	course := m.courseForGoalLocked(goalID)
	if course == nil {
		course = &memoryCourse{
			userID:    userID,
			goalID:    goalID,
			status:    "draft",
			versions:  map[string]*domain.CourseVersion{},
			createdAt: m.now().UTC(),
		}
		m.courses[uuid.NewString()] = course
	}
	if course.userID != userID {
		return nil, ErrNotFound
	}
	now := m.now().UTC()
	versionNumber := 1
	for _, existing := range course.versions {
		if existing.VersionNumber >= versionNumber {
			versionNumber = existing.VersionNumber + 1
		}
		if existing.Status == "draft" {
			existing.Status = "superseded"
		}
	}
	version := buildVersion(m.courseIDForLocked(course), versionNumber, blueprint, warnings, metadata, now)
	course.versions[version.ID] = version
	course.currentID = version.ID
	if course.approvedID == "" {
		course.status = "draft"
	} else {
		course.status = "approved"
	}
	course.updatedAt = now
	goal.Status = "course_draft"
	goal.LastError = nil
	goal.UpdatedAt = now
	return m.detailLocked(course), nil
}

func (m *Memory) GetCourse(_ context.Context, userID, courseID string) (*domain.CourseDetail, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	course, ok := m.courses[courseID]
	if !ok || course.userID != userID {
		return nil, ErrNotFound
	}
	return m.detailLocked(course), nil
}

func (m *Memory) ListCourses(_ context.Context, userID string) ([]domain.CourseSummary, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	courses := []domain.CourseSummary{}
	for id, course := range m.courses {
		if course.userID != userID {
			continue
		}
		version := course.versions[course.currentID]
		if version == nil {
			version = course.versions[course.approvedID]
		}
		if version == nil {
			continue
		}
		counts := countsFor(version)
		summary := domain.CourseSummary{
			ID:                       id,
			LearningGoalID:           course.goalID,
			Status:                   course.status,
			Title:                    version.Title,
			ShortDescription:         version.ShortDescription,
			VersionNumber:            version.VersionNumber,
			VersionStatus:            version.Status,
			TargetLearnerLevel:       version.TargetLearnerLevel,
			EstimatedDurationMinutes: version.EstimatedDurationMinutes,
			Counts:                   counts,
			CreatedAt:                course.createdAt,
			UpdatedAt:                course.updatedAt,
		}
		if course.currentID != "" {
			value := course.currentID
			summary.CurrentVersionID = &value
		}
		if course.approvedID != "" {
			value := course.approvedID
			summary.ApprovedVersionID = &value
		}
		if course.currentID != "" && course.currentID != course.approvedID {
			value := course.currentID
			summary.DraftVersionID = &value
			summary.HasDraft = true
		}
		courses = append(courses, summary)
	}
	sort.Slice(courses, func(i, j int) bool { return courses[i].UpdatedAt.After(courses[j].UpdatedAt) })
	return courses, nil
}

func (m *Memory) UpdateDraft(_ context.Context, userID, courseID string, patch domain.UpdateDraftInput) (*domain.CourseDetail, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	course, ok := m.courses[courseID]
	if !ok || course.userID != userID {
		return nil, ErrNotFound
	}
	version, ok := course.versions[patch.VersionID]
	if !ok {
		return nil, ErrNotFound
	}
	if version.Status != "draft" {
		return nil, ErrConflict
	}
	if patch.Title != nil {
		version.Title = *patch.Title
	}
	if patch.ShortDescription != nil {
		version.ShortDescription = *patch.ShortDescription
	}
	if patch.Description != nil {
		version.Description = *patch.Description
	}
	for _, edit := range patch.Modules {
		found := false
		for index := range version.Modules {
			if version.Modules[index].ID != edit.ID {
				continue
			}
			found = true
			if edit.Title != nil {
				version.Modules[index].Title = *edit.Title
			}
			if edit.Description != nil {
				version.Modules[index].Description = *edit.Description
			}
		}
		if !found {
			return nil, ErrNotFound
		}
	}
	for _, edit := range patch.Classes {
		found := false
		for moduleIndex := range version.Modules {
			for classIndex := range version.Modules[moduleIndex].Classes {
				klass := &version.Modules[moduleIndex].Classes[classIndex]
				if klass.ID != edit.ID {
					continue
				}
				found = true
				if edit.Title != nil {
					klass.Title = *edit.Title
				}
				if edit.Description != nil {
					klass.Description = *edit.Description
				}
			}
		}
		if !found {
			return nil, ErrNotFound
		}
	}
	course.updatedAt = m.now().UTC()
	return m.detailLocked(course), nil
}

func (m *Memory) ApproveCourse(_ context.Context, userID, courseID, versionID string) (*domain.CourseDetail, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	course, ok := m.courses[courseID]
	if !ok || course.userID != userID {
		return nil, ErrNotFound
	}
	version, ok := course.versions[versionID]
	if !ok {
		return nil, ErrNotFound
	}
	if course.approvedID == versionID && version.Status == "approved" {
		return m.detailLocked(course), nil
	}
	if version.Status != "draft" {
		return nil, ErrConflict
	}
	counts := countsFor(version)
	if counts.Modules == 0 || counts.Classes == 0 || counts.Lessons == 0 {
		return nil, ErrInvalidState
	}
	now := m.now().UTC()
	for id, existing := range course.versions {
		if id != versionID && existing.Status == "approved" {
			existing.Status = "superseded"
		}
	}
	version.Status = "approved"
	version.ApprovedAt = &now
	course.approvedID = versionID
	course.currentID = versionID
	course.status = "approved"
	course.updatedAt = now
	m.enrollments[userID+":"+courseID] = true
	if goal, ok := m.goals[course.goalID]; ok {
		goal.Status = "approved"
		goal.LastError = nil
		goal.UpdatedAt = now
	}
	return m.detailLocked(course), nil
}

// Enrolled exposes enrollment state to tests without widening the Store interface.
func (m *Memory) Enrolled(userID, courseID string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.enrollments[userID+":"+courseID]
}

func (m *Memory) latestAttemptLocked(goalID string) *memoryAttempt {
	var latest *memoryAttempt
	for _, attempt := range m.attempts {
		if attempt.goalID != goalID {
			continue
		}
		if latest == nil || attempt.attempt.AttemptNumber > latest.attempt.AttemptNumber {
			latest = attempt
		}
	}
	return latest
}

func (m *Memory) courseForGoalLocked(goalID string) *memoryCourse {
	for _, course := range m.courses {
		if course.goalID == goalID {
			return course
		}
	}
	return nil
}

func (m *Memory) detailLocked(course *memoryCourse) *domain.CourseDetail {
	id := m.courseIDForLocked(course)
	detail := &domain.CourseDetail{
		ID:             id,
		LearningGoalID: course.goalID,
		Status:         course.status,
		CreatedAt:      course.createdAt,
		UpdatedAt:      course.updatedAt,
	}
	if course.currentID != "" {
		value := course.currentID
		detail.CurrentVersionID = &value
		detail.Version = cloneVersion(course.versions[course.currentID])
		if detail.Version != nil {
			detail.Counts = countsFor(detail.Version)
		}
	}
	if course.approvedID != "" {
		value := course.approvedID
		detail.ApprovedVersionID = &value
		detail.ApprovedVersion = cloneVersion(course.versions[course.approvedID])
		if detail.Version == nil {
			detail.Version = cloneVersion(detail.ApprovedVersion)
			if detail.Version != nil {
				detail.Counts = countsFor(detail.Version)
			}
		}
	}
	return detail
}

func (m *Memory) courseIDForLocked(course *memoryCourse) string {
	for id, candidate := range m.courses {
		if candidate == course {
			return id
		}
	}
	return ""
}

func buildVersion(courseID string, number int, blueprint domain.CourseBlueprint, warnings []string, metadata domain.GenerationMetadata, now time.Time) *domain.CourseVersion {
	version := &domain.CourseVersion{
		ID:                            uuid.NewString(),
		CourseID:                      courseID,
		VersionNumber:                 number,
		Status:                        "draft",
		Title:                         blueprint.Title,
		ShortDescription:              blueprint.ShortDescription,
		Description:                   blueprint.Description,
		LearningGoal:                  blueprint.LearningGoal,
		TargetLearnerLevel:            blueprint.TargetLearnerLevel,
		Objectives:                    append([]domain.Objective(nil), blueprint.Objectives...),
		TargetCompetencies:            append([]domain.Competency(nil), blueprint.TargetCompetencies...),
		Prerequisites:                 append([]domain.Prerequisite(nil), blueprint.Prerequisites...),
		EstimatedDurationMinutes:      blueprint.EstimatedDurationMinutes,
		RecommendedWeeklyStudyMinutes: blueprint.RecommendedWeeklyStudyMinutes,
		Methodology:                   blueprint.Methodology,
		ExpectedOutcome:               blueprint.ExpectedOutcome,
		FinalProject:                  blueprint.FinalProject,
		FinalAssessment:               blueprint.FinalAssessment,
		Assumptions:                   append([]string(nil), blueprint.Assumptions...),
		SuggestedSearchTopics:         append([]string(nil), blueprint.SuggestedSearchTopics...),
		GenerationMetadata:            metadata,
		Warnings:                      append([]string(nil), warnings...),
		CreatedAt:                     now,
	}
	type idTitle struct {
		id    string
		title string
	}
	moduleIDs := map[string]idTitle{}
	classIDs := map[string]idTitle{}
	for _, module := range blueprint.Modules {
		moduleIDs[module.ID] = idTitle{id: uuid.NewString(), title: module.Title}
		for _, class := range module.Classes {
			classIDs[class.ID] = idTitle{id: uuid.NewString(), title: class.Title}
		}
	}
	for _, module := range blueprint.Modules {
		entry := moduleIDs[module.ID]
		item := domain.CourseModule{
			ID:                        entry.id,
			SourceID:                  module.ID,
			Sequence:                  module.Sequence,
			Title:                     module.Title,
			Description:               module.Description,
			Objectives:                append([]domain.Objective(nil), module.Objectives...),
			Skills:                    append([]string(nil), module.Skills...),
			EstimatedDurationMinutes:  module.EstimatedDurationMinutes,
			RequiredPreviousModuleIDs: append([]string(nil), module.RequiredPreviousModuleIDs...),
			RequiredPreviousModules:   []domain.Reference{},
		}
		for _, source := range module.RequiredPreviousModuleIDs {
			if previous, ok := moduleIDs[source]; ok {
				item.RequiredPreviousModules = append(item.RequiredPreviousModules, domain.Reference{ID: previous.id, Title: previous.title})
			}
		}
		for _, class := range module.Classes {
			classEntry := classIDs[class.ID]
			klass := domain.CourseClass{
				ID:                       classEntry.id,
				SourceID:                 class.ID,
				Sequence:                 class.Sequence,
				Title:                    class.Title,
				Description:              class.Description,
				Objectives:               append([]domain.Objective(nil), class.Objectives...),
				PrerequisiteClassIDs:     append([]string(nil), class.PrerequisiteClassIDs...),
				Prerequisites:            []domain.Reference{},
				EstimatedDurationMinutes: class.EstimatedDurationMinutes,
				KeyConcepts:              append([]string(nil), class.KeyConcepts...),
				KnowledgeCheck:           class.KnowledgeCheck,
				Lessons:                  []domain.Lesson{},
			}
			exercise := class.Exercise
			klass.Exercise = &exercise
			for _, source := range class.PrerequisiteClassIDs {
				if previous, ok := classIDs[source]; ok {
					klass.Prerequisites = append(klass.Prerequisites, domain.Reference{ID: previous.id, Title: previous.title})
				}
			}
			for _, lesson := range class.Lessons {
				klass.Lessons = append(klass.Lessons, domain.Lesson{
					ID:                       uuid.NewString(),
					SourceID:                 lesson.ID,
					Sequence:                 lesson.Sequence,
					Title:                    lesson.Title,
					Description:              lesson.Description,
					EstimatedDurationMinutes: lesson.EstimatedDurationMinutes,
					Blueprint:                lesson.Blueprint,
				})
			}
			item.Classes = append(item.Classes, klass)
		}
		version.Modules = append(version.Modules, item)
	}
	return version
}

func cloneGoal(goal *domain.LearningGoal) *domain.LearningGoal {
	copy := *goal
	copy.CurrentKnowledge = copyMap(goal.CurrentKnowledge)
	copy.LearningPreferences = copyMap(goal.LearningPreferences)
	return &copy
}

func cloneAttempt(attempt *domain.DiagnosticAttempt) *domain.DiagnosticAttempt {
	copy := *attempt
	copy.Strengths = append([]domain.Strength(nil), attempt.Strengths...)
	copy.KnowledgeGaps = append([]domain.KnowledgeGap(nil), attempt.KnowledgeGaps...)
	copy.Misconceptions = append([]string(nil), attempt.Misconceptions...)
	copy.QuestionScores = append([]domain.QuestionScore(nil), attempt.QuestionScores...)
	copy.CanSkip = append([]string(nil), attempt.CanSkip...)
	copy.Questions = make([]domain.DiagnosticQuestion, len(attempt.Questions))
	for index, question := range attempt.Questions {
		question.Choices = append([]domain.Choice(nil), question.Choices...)
		copy.Questions[index] = question
	}
	copy.Answers = cloneAnswers(attempt.Answers)
	return &copy
}

func cloneAnswers(answers []domain.DiagnosticAnswer) []domain.DiagnosticAnswer {
	result := make([]domain.DiagnosticAnswer, len(answers))
	for index, answer := range answers {
		if answer.Score != nil {
			value := *answer.Score
			answer.Score = &value
		}
		result[index] = answer
	}
	return result
}

func cloneVersion(version *domain.CourseVersion) *domain.CourseVersion {
	if version == nil {
		return nil
	}
	data, err := json.Marshal(version)
	if err != nil {
		return nil
	}
	var copy domain.CourseVersion
	if err := json.Unmarshal(data, &copy); err != nil {
		return nil
	}
	return &copy
}

func copyMap(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}
	output := make(map[string]any, len(input))
	for key, value := range input {
		output[key] = value
	}
	return output
}

func stringPtr(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func (m *Memory) CreateConversation(_ context.Context, userID string, input domain.CreateConversationInput) (*domain.Conversation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := m.now().UTC()
	title := stringsTrim(input.Title)
	if title == "" {
		title = "New conversation"
	}
	mode := stringsTrim(input.TutorMode)
	if mode == "" {
		mode = "explain"
	}

	conv := &domain.Conversation{
		ID:          uuid.NewString(),
		UserID:      userID,
		Title:       title,
		TutorMode:   mode,
		ContextType: input.ContextType,
		ContextID:   input.ContextID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	m.conversations[conv.ID] = conv
	m.messages[conv.ID] = []domain.Message{}
	return conv, nil
}

func (m *Memory) ListConversations(_ context.Context, userID string) ([]domain.Conversation, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []domain.Conversation
	for _, conv := range m.conversations {
		if conv.UserID == userID {
			result = append(result, *conv)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].UpdatedAt.After(result[j].UpdatedAt)
	})
	return result, nil
}

func (m *Memory) GetConversation(_ context.Context, userID, conversationID string) (*domain.ConversationDetail, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conv, exists := m.conversations[conversationID]
	if !exists || conv.UserID != userID {
		return nil, ErrNotFound
	}
	msgs := m.messages[conversationID]
	if msgs == nil {
		msgs = []domain.Message{}
	}
	return &domain.ConversationDetail{
		Conversation: *conv,
		Messages:     msgs,
	}, nil
}

func (m *Memory) UpdateConversation(_ context.Context, userID, conversationID string, input domain.UpdateConversationInput) (*domain.Conversation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, exists := m.conversations[conversationID]
	if !exists || conv.UserID != userID {
		return nil, ErrNotFound
	}
	if input.Title != nil && stringsTrim(*input.Title) != "" {
		conv.Title = stringsTrim(*input.Title)
	}
	if input.TutorMode != nil && stringsTrim(*input.TutorMode) != "" {
		conv.TutorMode = stringsTrim(*input.TutorMode)
	}
	conv.UpdatedAt = m.now().UTC()
	return conv, nil
}

func (m *Memory) DeleteConversation(_ context.Context, userID, conversationID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, exists := m.conversations[conversationID]
	if !exists || conv.UserID != userID {
		return ErrNotFound
	}
	delete(m.conversations, conversationID)
	delete(m.messages, conversationID)
	return nil
}

func (m *Memory) AddMessage(_ context.Context, userID, conversationID string, role, content, model string, tokenUsage, metadata map[string]any) (*domain.Message, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	conv, exists := m.conversations[conversationID]
	if !exists || conv.UserID != userID {
		return nil, ErrNotFound
	}
	now := m.now().UTC()
	msg := domain.Message{
		ID:             uuid.NewString(),
		ConversationID: conversationID,
		UserID:         userID,
		Role:           role,
		Content:        content,
		Model:          model,
		TokenUsage:     tokenUsage,
		Metadata:       metadata,
		CreatedAt:      now,
	}
	m.messages[conversationID] = append(m.messages[conversationID], msg)
	conv.UpdatedAt = now
	return &msg, nil
}

func (m *Memory) CompleteLesson(_ context.Context, userID, courseID, lessonID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.lessonCompletions[userID] == nil {
		m.lessonCompletions[userID] = map[string]bool{}
	}
	m.lessonCompletions[userID][lessonID] = true
	return nil
}

func (m *Memory) GetCompletedLessons(_ context.Context, userID, courseID string) ([]string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	userCompletions := m.lessonCompletions[userID]
	if userCompletions == nil {
		return []string{}, nil
	}
	var result []string
	for lessonID := range userCompletions {
		result = append(result, lessonID)
	}
	return result, nil
}

func (m *Memory) GetDashboard(ctx context.Context, userID string) (*domain.DashboardData, error) {
	goals, _ := m.ListLearningGoals(ctx, userID)
	courses, _ := m.ListCourses(ctx, userID)

	approvedCount := 0
	draftCount := 0
	var activeCourse *domain.CourseSummary
	for _, c := range courses {
		if c.Status == "approved" {
			approvedCount++
			if activeCourse == nil {
				activeCourse = &c
			}
		} else if c.HasDraft {
			draftCount++
		}
	}

	var recentGoal *domain.LearningGoal
	if len(goals) > 0 {
		recentGoal = &goals[0]
	}

	completedCount := 0
	m.mu.RLock()
	if userCompletions := m.lessonCompletions[userID]; userCompletions != nil {
		completedCount = len(userCompletions)
	}
	m.mu.RUnlock()

	return &domain.DashboardData{
		TotalGoals:            len(goals),
		TotalCourses:          len(courses),
		ApprovedCourses:       approvedCount,
		DraftCourses:          draftCount,
		RecentGoal:            recentGoal,
		ActiveCourse:          activeCourse,
		CompletedLessonCount:  completedCount,
		TotalStudyTimeMinutes: completedCount * 45, // realistic estimate based on completed lessons
	}, nil
}

func (m *Memory) GetProgress(ctx context.Context, userID string) (*domain.ProgressData, error) {
	courses, _ := m.ListCourses(ctx, userID)
	var enrolled []domain.CourseSummary
	totalLessons := 0
	totalClasses := 0
	totalModules := 0

	for _, c := range courses {
		if c.Status == "approved" {
			enrolled = append(enrolled, c)
			totalLessons += c.Counts.Lessons
			totalModules += c.Counts.Modules
			totalClasses += c.Counts.Classes
		}
	}

	completed, _ := m.GetCompletedLessons(ctx, userID, "")

	return &domain.ProgressData{
		EnrolledCourses:    enrolled,
		CompletedLessonIDs: completed,
		TotalLessons:       totalLessons,
		CompletedLessons:   len(completed),
		TotalClasses:       totalClasses,
		TotalModules:       totalModules,
	}, nil
}

func stringsTrim(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t' || s[0] == '\n' || s[0] == '\r') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t' || s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}
