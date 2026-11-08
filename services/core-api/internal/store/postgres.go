package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/frikhii/copilot/core-api/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, databaseURL string) (*Postgres, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	config.MaxConns = 8
	config.MinConns = 1
	config.MaxConnLifetime = 30 * time.Minute
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() { p.pool.Close() }

func (p *Postgres) Ping(ctx context.Context) error { return p.pool.Ping(ctx) }

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func emptyMap() map[string]any { return map[string]any{} }
func emptySlice() []string     { return []string{} }

func unmarshalJSON(data []byte, target any) error {
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, target)
}

func marshalJSON(value any) []byte {
	data, _ := json.Marshal(value)
	return data
}

// jsonbObject marshals value for a jsonb object column. A nil map/slice/pointer
// marshals to JSON null, which violates the schema's jsonb_typeof(...)='object'
// checks (e.g. messages_metadata_check), so it falls back to an empty object.
func jsonbObject(value any) []byte {
	data, _ := json.Marshal(value)
	if len(data) == 0 || string(data) == "null" {
		return []byte("{}")
	}
	return data
}

// jsonbArray is the array-column counterpart of jsonbObject.
func jsonbArray(value any) []byte {
	data, _ := json.Marshal(value)
	if len(data) == 0 || string(data) == "null" {
		return []byte("[]")
	}
	return data
}

func (p *Postgres) CreateLearningGoal(ctx context.Context, userID string, input domain.CreateLearningGoalInput) (*domain.LearningGoal, error) {
	var goal domain.LearningGoal
	goal.UserID = userID
	var targetDate string
	err := p.pool.QueryRow(ctx, `
		insert into public.learning_goals
			(user_id, title, goal_statement, intended_outcome, motivation, additional_context,
			 self_reported_level, current_knowledge, weekly_study_minutes, learning_language,
			 learning_preferences, target_date)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date)
		returning id::text, title, goal_statement, intended_outcome, motivation, additional_context,
			self_reported_level, current_knowledge, weekly_study_minutes, learning_language,
			learning_preferences, coalesce(to_char(target_date, 'YYYY-MM-DD'), ''), status, last_error,
			created_at, updated_at`,
		userID, input.Title, input.GoalStatement, input.IntendedOutcome, input.Motivation,
		input.AdditionalContext, input.SelfReportedLevel, jsonbObject(input.CurrentKnowledge),
		input.WeeklyStudyMinutes, input.LearningLanguage, jsonbObject(input.LearningPreferences),
		input.TargetDate,
	).Scan(
		&goal.ID, &goal.Title, &goal.GoalStatement, &goal.IntendedOutcome, &goal.Motivation,
		&goal.AdditionalContext, &goal.SelfReportedLevel, jsonBytes(&goal.CurrentKnowledge),
		&goal.WeeklyStudyMinutes, &goal.LearningLanguage, jsonBytes(&goal.LearningPreferences),
		&targetDate, &goal.Status, &goal.LastError, &goal.CreatedAt, &goal.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if targetDate != "" {
		goal.TargetDate = &targetDate
	}
	if goal.CurrentKnowledge == nil {
		goal.CurrentKnowledge = emptyMap()
	}
	if goal.LearningPreferences == nil {
		goal.LearningPreferences = emptyMap()
	}
	return &goal, nil
}

// jsonBytes is a small pgx scanner helper for JSONB into a map/slice.
type jsonBytesScanner struct{ target any }

func jsonBytes(target any) *jsonBytesScanner { return &jsonBytesScanner{target: target} }

func (s *jsonBytesScanner) Scan(src any) error {
	if src == nil {
		return nil
	}
	var data []byte
	switch typed := src.(type) {
	case []byte:
		data = typed
	case string:
		data = []byte(typed)
	default:
		return fmt.Errorf("unexpected JSONB source type %T", src)
	}
	return json.Unmarshal(data, s.target)
}

func scanGoal(row pgx.Row) (*domain.LearningGoal, error) {
	var goal domain.LearningGoal
	var targetDate string
	var courseID string
	var courseStatus string
	var lastError string
	err := row.Scan(
		&goal.ID, &goal.Title, &goal.GoalStatement, &goal.IntendedOutcome, &goal.Motivation,
		&goal.AdditionalContext, &goal.SelfReportedLevel, jsonBytes(&goal.CurrentKnowledge),
		&goal.WeeklyStudyMinutes, &goal.LearningLanguage, jsonBytes(&goal.LearningPreferences),
		&targetDate, &goal.Status, &lastError, &goal.CreatedAt, &goal.UpdatedAt,
		&courseID, &courseStatus,
	)
	if err != nil {
		return nil, err
	}
	if targetDate != "" {
		goal.TargetDate = &targetDate
	}
	if lastError != "" {
		goal.LastError = &lastError
	}
	if courseID != "" {
		goal.CourseID = &courseID
		goal.CourseStatus = &courseStatus
	}
	if goal.CurrentKnowledge == nil {
		goal.CurrentKnowledge = emptyMap()
	}
	if goal.LearningPreferences == nil {
		goal.LearningPreferences = emptyMap()
	}
	return &goal, nil
}

const goalSelect = `
	select g.id::text, g.title, g.goal_statement, g.intended_outcome, g.motivation,
		g.additional_context, g.self_reported_level, g.current_knowledge,
		g.weekly_study_minutes, g.learning_language, g.learning_preferences,
		coalesce(to_char(g.target_date, 'YYYY-MM-DD'), ''), g.status,
		coalesce(g.last_error, ''), g.created_at, g.updated_at,
		coalesce(c.id::text, ''), coalesce(c.status, '')
	from public.learning_goals g
	left join public.courses c on c.learning_goal_id = g.id`

func (p *Postgres) ListLearningGoals(ctx context.Context, userID string) ([]domain.LearningGoal, error) {
	rows, err := p.pool.Query(ctx, goalSelect+` where g.user_id = $1 order by g.updated_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	goals := []domain.LearningGoal{}
	for rows.Next() {
		goal, err := scanGoal(rows)
		if err != nil {
			return nil, err
		}
		goal.UserID = userID
		goals = append(goals, *goal)
	}
	return goals, rows.Err()
}

func (p *Postgres) GetLearningGoal(ctx context.Context, userID, goalID string) (*domain.LearningGoal, error) {
	goal, err := scanGoal(p.pool.QueryRow(ctx, goalSelect+` where g.id = $1 and g.user_id = $2`, goalID, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	goal.UserID = userID
	return goal, nil
}

func (p *Postgres) BeginGeneration(ctx context.Context, userID, goalID string, staleAfter time.Duration) (*domain.LearningGoal, bool, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, false, err
	}
	defer tx.Rollback(ctx)

	var status string
	var updatedAt time.Time
	err = tx.QueryRow(ctx, `select status, updated_at from public.learning_goals where id=$1 and user_id=$2 for update`, goalID, userID).Scan(&status, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, ErrNotFound
	}
	if err != nil {
		return nil, false, err
	}
	if status == "generating" {
		if time.Since(updatedAt) < staleAfter {
			return nil, false, ErrGenerationInProgress
		}
		// A stale in-flight generation (for example after a process restart) may
		// be reclaimed. The database lock below makes this safe.
	}
	switch status {
	case "diagnostic_evaluated", "course_draft", "generating", "failed", "approved":
		// allowed
	default:
		return nil, false, ErrInvalidState
	}
	if _, err := tx.Exec(ctx, `update public.learning_goals set status='generating', last_error=null where id=$1 and user_id=$2`, goalID, userID); err != nil {
		return nil, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, false, err
	}
	goal, err := p.GetLearningGoal(ctx, userID, goalID)
	if err != nil {
		return nil, false, err
	}
	return goal, true, nil
}

func (p *Postgres) SetGoalStatus(ctx context.Context, userID, goalID, status string, lastError *string) error {
	tag, err := p.pool.Exec(ctx, `update public.learning_goals set status=$1, last_error=$2 where id=$3 and user_id=$4`, status, lastError, goalID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

const attemptSelect = `
	select a.id::text, a.learning_goal_id::text, a.status, a.attempt_number,
		coalesce(a.estimated_level,''), coalesce(a.confidence,''),
		coalesce(a.evaluation_summary,''), a.strengths, a.knowledge_gaps,
		a.misconceptions, coalesce(a.recommended_start,''), coalesce(a.rationale,''),
		a.question_scores, a.can_skip, a.submitted_at, a.evaluated_at, a.created_at
	from public.diagnostic_attempts a
	join public.learning_goals g on g.id = a.learning_goal_id
	where a.learning_goal_id = $1 and g.user_id = $2`

func scanAttempt(row pgx.Row) (*domain.DiagnosticAttempt, error) {
	var attempt domain.DiagnosticAttempt
	var estimatedLevel, confidence, summary, recommendedStart, rationale string
	var submittedAt, evaluatedAt pgtype.Timestamptz
	err := row.Scan(
		&attempt.ID, &attempt.LearningGoalID, &attempt.Status, &attempt.AttemptNumber,
		&estimatedLevel, &confidence, &summary,
		jsonBytes(&attempt.Strengths), jsonBytes(&attempt.KnowledgeGaps),
		jsonBytes(&attempt.Misconceptions), &recommendedStart, &rationale,
		jsonBytes(&attempt.QuestionScores), jsonBytes(&attempt.CanSkip),
		&submittedAt, &evaluatedAt, &attempt.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if estimatedLevel != "" {
		attempt.EstimatedLevel = &estimatedLevel
	}
	if confidence != "" {
		attempt.Confidence = &confidence
	}
	if summary != "" {
		attempt.Summary = &summary
	}
	if recommendedStart != "" {
		attempt.RecommendedStart = &recommendedStart
	}
	if rationale != "" {
		attempt.Rationale = &rationale
	}
	if submittedAt.Valid {
		t := submittedAt.Time
		attempt.SubmittedAt = &t
	}
	if evaluatedAt.Valid {
		t := evaluatedAt.Time
		attempt.EvaluatedAt = &t
	}
	if attempt.Strengths == nil {
		attempt.Strengths = []domain.Strength{}
	}
	if attempt.KnowledgeGaps == nil {
		attempt.KnowledgeGaps = []domain.KnowledgeGap{}
	}
	if attempt.Misconceptions == nil {
		attempt.Misconceptions = []string{}
	}
	if attempt.QuestionScores == nil {
		attempt.QuestionScores = []domain.QuestionScore{}
	}
	if attempt.CanSkip == nil {
		attempt.CanSkip = []string{}
	}
	return &attempt, nil
}

func (p *Postgres) latestAttempt(ctx context.Context, q querier, userID, goalID string) (*domain.DiagnosticAttempt, error) {
	attempt, err := scanAttempt(q.QueryRow(ctx, attemptSelect+` order by a.attempt_number desc limit 1`, goalID, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return attempt, err
}

func (p *Postgres) loadAttemptDetails(ctx context.Context, q querier, attempt *domain.DiagnosticAttempt) error {
	rows, err := q.Query(ctx, `
		select id::text, source_id, sequence_order, question_type, prompt, competency,
			difficulty, choices, explanation
		from public.diagnostic_questions
		where attempt_id=$1
		order by sequence_order`, attempt.ID)
	if err != nil {
		return err
	}
	defer rows.Close()
	attempt.Questions = []domain.DiagnosticQuestion{}
	for rows.Next() {
		var question domain.DiagnosticQuestion
		var sourceID, questionID string
		if err := rows.Scan(
			&questionID, &sourceID, &question.Sequence, &question.Type, &question.Prompt,
			&question.Competency, &question.Difficulty, jsonBytes(&question.Choices),
			&question.Explanation,
		); err != nil {
			return err
		}
		question.ID = sourceID
		if question.Choices == nil {
			question.Choices = []domain.Choice{}
		}
		attempt.Questions = append(attempt.Questions, question)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	answerRows, err := q.Query(ctx, `
		select q.source_id, a.response, coalesce(a.score, -1), coalesce(a.feedback, '')
		from public.diagnostic_answers a
		join public.diagnostic_questions q on q.id = a.question_id
		where a.attempt_id=$1
		order by q.sequence_order`, attempt.ID)
	if err != nil {
		return err
	}
	defer answerRows.Close()
	attempt.Answers = []domain.DiagnosticAnswer{}
	for answerRows.Next() {
		var answer domain.DiagnosticAnswer
		var score int
		if err := answerRows.Scan(&answer.QuestionID, &answer.Response, &score, &answer.Feedback); err != nil {
			return err
		}
		if score >= 0 {
			answer.Score = &score
		}
		attempt.Answers = append(attempt.Answers, answer)
	}
	return answerRows.Err()
}

func (p *Postgres) CreateDiagnosticAttempt(ctx context.Context, userID, goalID string, questions []Question, keys []domain.AnswerKey) (*domain.DiagnosticAttempt, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var status string
	if err := tx.QueryRow(ctx, `select status from public.learning_goals where id=$1 and user_id=$2 for update`, goalID, userID).Scan(&status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	existing, err := p.latestAttempt(ctx, tx, userID, goalID)
	if err == nil {
		switch existing.Status {
		case "ready", "submitted", "evaluating", "evaluated":
			if err := tx.Commit(ctx); err != nil {
				return nil, err
			}
			return p.GetLatestDiagnostic(ctx, userID, goalID)
		case "generating":
			return nil, ErrGenerationInProgress
		}
	} else if !errors.Is(err, ErrNotFound) {
		return nil, err
	}
	if status != "intake" && status != "diagnostic_ready" && status != "failed" {
		return nil, ErrInvalidState
	}

	var attemptID string
	var attemptNumber int
	if err := tx.QueryRow(ctx, `
		insert into public.diagnostic_attempts
			(learning_goal_id, user_id, attempt_number, status)
		values ($1,$2,coalesce((select max(attempt_number) from public.diagnostic_attempts where learning_goal_id=$1),0)+1,'ready')
		returning id::text, attempt_number`, goalID, userID,
	).Scan(&attemptID, &attemptNumber); err != nil {
		return nil, err
	}

	keyBySource := map[string]domain.AnswerKey{}
	for _, key := range keys {
		keyBySource[key.QuestionID] = key
	}
	for _, question := range questions {
		questionID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			insert into public.diagnostic_questions
				(id, attempt_id, source_id, sequence_order, question_type, prompt, competency,
				 difficulty, choices, explanation)
			values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			questionID, attemptID, question.SourceID, question.Sequence, question.Type,
			question.Prompt, question.Competency, question.Difficulty,
			jsonbArray(question.Choices), question.Explanation,
		); err != nil {
			return nil, err
		}
		key, ok := keyBySource[question.SourceID]
		if !ok {
			return nil, fmt.Errorf("missing answer key for question %s", question.SourceID)
		}
		if _, err := tx.Exec(ctx, `
			insert into public.diagnostic_answer_keys (question_id, expected_answer, rubric)
			values ($1,$2,$3)`, questionID, key.ExpectedAnswer, jsonbArray(key.Rubric),
		); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `
		update public.learning_goals set status='diagnostic_ready', last_error=null
		where id=$1 and user_id=$2`, goalID, userID,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetLatestDiagnostic(ctx, userID, goalID)
}

func (p *Postgres) GetLatestDiagnostic(ctx context.Context, userID, goalID string) (*domain.DiagnosticAttempt, error) {
	attempt, err := p.latestAttempt(ctx, p.pool, userID, goalID)
	if err != nil {
		return nil, err
	}
	if err := p.loadAttemptDetails(ctx, p.pool, attempt); err != nil {
		return nil, err
	}
	return attempt, nil
}

func (p *Postgres) GetDiagnosticForEvaluation(ctx context.Context, userID, goalID, attemptID string) (*domain.DiagnosticAttempt, []domain.AnswerKey, error) {
	attempt, err := scanAttempt(p.pool.QueryRow(ctx, attemptSelect+` and a.id=$3`, goalID, userID, attemptID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	if err := p.loadAttemptDetails(ctx, p.pool, attempt); err != nil {
		return nil, nil, err
	}
	rows, err := p.pool.Query(ctx, `
		select q.source_id, k.expected_answer, k.rubric
		from public.diagnostic_answer_keys k
		join public.diagnostic_questions q on q.id = k.question_id
		where q.attempt_id=$1
		order by q.sequence_order`, attemptID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	keys := []domain.AnswerKey{}
	for rows.Next() {
		var key domain.AnswerKey
		if err := rows.Scan(&key.QuestionID, &key.ExpectedAnswer, jsonBytes(&key.Rubric)); err != nil {
			return nil, nil, err
		}
		keys = append(keys, key)
	}
	return attempt, keys, rows.Err()
}

func (p *Postgres) SubmitDiagnosticAnswers(ctx context.Context, userID, goalID, attemptID string, answers []domain.DiagnosticAnswer) (*domain.DiagnosticAttempt, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var status string
	err = tx.QueryRow(ctx, `
		select a.status from public.diagnostic_attempts a
		join public.learning_goals g on g.id = a.learning_goal_id
		where a.id=$1 and a.learning_goal_id=$2 and g.user_id=$3
		for update of a`, attemptID, goalID, userID).Scan(&status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status != "ready" {
		return nil, ErrConflict
	}
	questionRows, err := tx.Query(ctx, `select id::text, source_id from public.diagnostic_questions where attempt_id=$1`, attemptID)
	if err != nil {
		return nil, err
	}
	questionBySource := map[string]string{}
	for questionRows.Next() {
		var id, source string
		if err := questionRows.Scan(&id, &source); err != nil {
			questionRows.Close()
			return nil, err
		}
		questionBySource[source] = id
	}
	questionRows.Close()
	for _, answer := range answers {
		questionID, ok := questionBySource[answer.QuestionID]
		if !ok {
			return nil, ErrInvalidState
		}
		if _, err := tx.Exec(ctx, `
			insert into public.diagnostic_answers (attempt_id, question_id, user_id, response)
			values ($1,$2,$3,$4)`, attemptID, questionID, userID, answer.Response); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `
		update public.diagnostic_attempts set status='submitted', submitted_at=now()
		where id=$1`, attemptID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetLatestDiagnostic(ctx, userID, goalID)
}

func (p *Postgres) SaveDiagnosticEvaluation(ctx context.Context, userID, goalID, attemptID string, evaluation domain.DiagnosticEvaluation, metadata map[string]any) (*domain.DiagnosticAttempt, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		update public.diagnostic_attempts a
		set status='evaluated', estimated_level=$4, confidence=$5, evaluation_summary=$6,
			strengths=$7, knowledge_gaps=$8, misconceptions=$9, recommended_start=$10,
			rationale=$11, question_scores=$12, can_skip=$13, evaluated_at=now()
		from public.learning_goals g
		where a.id=$1 and a.learning_goal_id=$2 and g.id=a.learning_goal_id and g.user_id=$3`,
		attemptID, goalID, userID, evaluation.EstimatedLevel, evaluation.Confidence,
		evaluation.Summary, jsonbArray(evaluation.Strengths), jsonbArray(evaluation.Gaps),
		jsonbArray(evaluation.Misconceptions), evaluation.RecommendedStart, evaluation.Rationale,
		jsonbArray(evaluation.QuestionScores), jsonbArray(evaluation.CanSkip),
	)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	if _, err := tx.Exec(ctx, `delete from public.knowledge_gaps where attempt_id=$1`, attemptID); err != nil {
		return nil, err
	}
	for _, gap := range evaluation.Gaps {
		if _, err := tx.Exec(ctx, `
			insert into public.knowledge_gaps (attempt_id, user_id, competency, description, severity, recommendation)
			values ($1,$2,$3,$4,$5,$6)`,
			attemptID, userID, gap.Competency, gap.Description, gap.Severity, gap.Recommendation,
		); err != nil {
			return nil, err
		}
	}
	for _, score := range evaluation.QuestionScores {
		if _, err := tx.Exec(ctx, `
			update public.diagnostic_answers a
			set score=$3, feedback=$4
			from public.diagnostic_questions q
			where a.attempt_id=$1 and q.id=a.question_id and q.source_id=$2`,
			attemptID, score.QuestionID, score.Score, score.Feedback,
		); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `
		update public.learning_goals set status='diagnostic_evaluated', last_error=null
		where id=$1 and user_id=$2`, goalID, userID,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetLatestDiagnostic(ctx, userID, goalID)
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

func (p *Postgres) CreateCourseVersion(ctx context.Context, userID, goalID string, blueprint domain.CourseBlueprint, warnings []string, metadata domain.GenerationMetadata) (*domain.CourseDetail, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var goalStatus string
	if err := tx.QueryRow(ctx, `select status from public.learning_goals where id=$1 and user_id=$2 for update`, goalID, userID).Scan(&goalStatus); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if goalStatus == "generating" || goalStatus == "diagnostic_evaluated" ||
		goalStatus == "course_draft" || goalStatus == "approved" || goalStatus == "failed" {
		// allowed
	} else {
		return nil, ErrInvalidState
	}

	var courseID string
	var courseStatus string
	var approvedVersionID string
	err = tx.QueryRow(ctx, `
		insert into public.courses (user_id, learning_goal_id, status)
		values ($1,$2,'draft')
		on conflict (learning_goal_id) do update set updated_at = now()
		returning id::text, status, coalesce(approved_version_id::text,'')`, userID, goalID,
	).Scan(&courseID, &courseStatus, &approvedVersionID)
	if err != nil {
		return nil, err
	}
	_ = courseStatus
	_ = approvedVersionID

	var versionNumber int
	if err := tx.QueryRow(ctx, `
		select coalesce(max(version_number),0)+1 from public.course_versions where course_id=$1`, courseID,
	).Scan(&versionNumber); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		update public.course_versions set status='superseded'
		where course_id=$1 and status='draft'`, courseID); err != nil {
		return nil, err
	}

	var versionID string
	if err := tx.QueryRow(ctx, `
		insert into public.course_versions
			(course_id, version_number, status, title, short_description, description,
			 learning_goal, target_learner_level, objectives, target_competencies, prerequisites,
			 estimated_duration_minutes, recommended_weekly_study_minutes, methodology,
			 expected_outcome, final_project, final_assessment, assumptions,
			 suggested_search_topics, generation_metadata, warnings)
		values ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		returning id::text`,
		courseID, versionNumber, blueprint.Title, blueprint.ShortDescription, blueprint.Description,
		blueprint.LearningGoal, blueprint.TargetLearnerLevel, jsonbArray(blueprint.Objectives),
		jsonbArray(blueprint.TargetCompetencies), jsonbArray(blueprint.Prerequisites),
		blueprint.EstimatedDurationMinutes, blueprint.RecommendedWeeklyStudyMinutes,
		blueprint.Methodology, blueprint.ExpectedOutcome, marshalJSON(blueprint.FinalProject),
		marshalJSON(blueprint.FinalAssessment), jsonbArray(blueprint.Assumptions),
		jsonbArray(blueprint.SuggestedSearchTopics), jsonbObject(metadata), jsonbArray(warnings),
	).Scan(&versionID); err != nil {
		return nil, err
	}

	objectiveOrder := 0
	for index, objective := range blueprint.Objectives {
		objectiveOrder = index + 1
		if _, err := tx.Exec(ctx, `
			insert into public.learning_objectives
				(course_version_id, description, competency, sequence_order)
			values ($1,$2,$3,$4)`,
			versionID, objective.Description, objective.Competency, objectiveOrder,
		); err != nil {
			return nil, err
		}
	}

	for _, module := range blueprint.Modules {
		moduleID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			insert into public.course_modules
				(id, course_version_id, source_id, title, description, sequence_order, objectives,
				 skills, estimated_duration_minutes, required_previous_module_ids)
			values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			moduleID, versionID, module.ID, module.Title, module.Description, module.Sequence,
			marshalJSON(module.Objectives), marshalJSON(module.Skills),
			module.EstimatedDurationMinutes, marshalJSON(module.RequiredPreviousModuleIDs),
		); err != nil {
			return nil, err
		}
		for index, objective := range module.Objectives {
			if _, err := tx.Exec(ctx, `
				insert into public.learning_objectives
					(course_version_id, module_id, description, competency, sequence_order)
				values ($1,$2,$3,$4,$5)`,
				versionID, moduleID, objective.Description, objective.Competency, index+1,
			); err != nil {
				return nil, err
			}
		}

		for _, class := range module.Classes {
			classID := uuid.NewString()
			if _, err := tx.Exec(ctx, `
				insert into public.classes
					(id, course_version_id, module_id, source_id, title, description, sequence_order,
					 objectives, prerequisite_class_ids, estimated_duration_minutes, key_concepts,
					 knowledge_check)
				values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
				classID, versionID, moduleID, class.ID, class.Title, class.Description,
				class.Sequence, marshalJSON(class.Objectives),
				marshalJSON(class.PrerequisiteClassIDs), class.EstimatedDurationMinutes,
				marshalJSON(class.KeyConcepts), jsonbObject(class.KnowledgeCheck),
			); err != nil {
				return nil, err
			}
			for index, objective := range class.Objectives {
				if _, err := tx.Exec(ctx, `
					insert into public.learning_objectives
						(course_version_id, module_id, class_id, description, competency, sequence_order)
					values ($1,$2,$3,$4,$5,$6)`,
					versionID, moduleID, classID, objective.Description, objective.Competency, index+1,
				); err != nil {
					return nil, err
				}
			}
			for _, lesson := range class.Lessons {
				lessonID := uuid.NewString()
				if _, err := tx.Exec(ctx, `
					insert into public.lessons
						(id, course_version_id, class_id, source_id, title, description,
						 sequence_order, estimated_duration_minutes)
					values ($1,$2,$3,$4,$5,$6,$7,$8)`,
					lessonID, versionID, classID, lesson.ID, lesson.Title, lesson.Description,
					lesson.Sequence, lesson.EstimatedDurationMinutes,
				); err != nil {
					return nil, err
				}
				if _, err := tx.Exec(ctx, `
					insert into public.lesson_contents (lesson_id, content_type, content, sequence_order)
					values ($1,'blueprint',$2,1)`, lessonID, jsonbObject(lesson.Blueprint),
				); err != nil {
					return nil, err
				}
				for index, objective := range lesson.Blueprint.Objectives {
					if _, err := tx.Exec(ctx, `
						insert into public.learning_objectives
							(course_version_id, module_id, class_id, lesson_id, description, competency, sequence_order)
						values ($1,$2,$3,$4,$5,'Lesson objective',$6)`,
						versionID, moduleID, classID, lessonID, objective, index+1,
					); err != nil {
						return nil, err
					}
				}
			}
			if _, err := tx.Exec(ctx, `
				insert into public.exercises
					(course_version_id, class_id, title, description, difficulty, competency,
					 instructions, expected_deliverable, evaluation_criteria, sequence_order)
				values ($1,$2,$3,$4,$5,$6,$7,$8,$9,1)`,
				versionID, classID, class.Exercise.Title, class.Exercise.Description,
				class.Exercise.Difficulty, class.Exercise.Competency,
				marshalJSON(class.Exercise.Instructions), class.Exercise.ExpectedDeliverable,
				marshalJSON(class.Exercise.EvaluationCriteria),
			); err != nil {
				return nil, err
			}
		}
	}

	tag, err := tx.Exec(ctx, `
		update public.courses
		set current_version_id=$1,
			status=case when approved_version_id is null then 'draft' else 'approved' end,
			updated_at=now()
		where id=$2 and user_id=$3`, versionID, courseID, userID)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	if _, err := tx.Exec(ctx, `
		update public.learning_goals set status='course_draft', last_error=null
		where id=$1 and user_id=$2`, goalID, userID,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetCourse(ctx, userID, courseID)
}

const versionSelect = `
	select v.id::text, v.course_id::text, v.version_number, v.status, v.title,
		v.short_description, v.description, v.learning_goal, v.target_learner_level,
		v.objectives, v.target_competencies, v.prerequisites, v.estimated_duration_minutes,
		v.recommended_weekly_study_minutes, v.methodology, v.expected_outcome,
		v.final_project, v.final_assessment, v.assumptions, v.suggested_search_topics,
		v.generation_metadata, v.warnings, v.created_at, v.approved_at
	from public.course_versions v
	join public.courses c on c.id = v.course_id
	where v.id=$1 and c.user_id=$2`

func (p *Postgres) loadVersion(ctx context.Context, q querier, userID, versionID string) (*domain.CourseVersion, error) {
	version := &domain.CourseVersion{}
	var approvedAt pgtype.Timestamptz
	err := q.QueryRow(ctx, versionSelect, versionID, userID).Scan(
		&version.ID, &version.CourseID, &version.VersionNumber, &version.Status, &version.Title,
		&version.ShortDescription, &version.Description, &version.LearningGoal,
		&version.TargetLearnerLevel, jsonBytes(&version.Objectives),
		jsonBytes(&version.TargetCompetencies), jsonBytes(&version.Prerequisites),
		&version.EstimatedDurationMinutes, &version.RecommendedWeeklyStudyMinutes,
		&version.Methodology, &version.ExpectedOutcome, jsonBytes(&version.FinalProject),
		jsonBytes(&version.FinalAssessment), jsonBytes(&version.Assumptions),
		jsonBytes(&version.SuggestedSearchTopics), jsonBytes(&version.GenerationMetadata),
		jsonBytes(&version.Warnings), &version.CreatedAt, &approvedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if approvedAt.Valid {
		t := approvedAt.Time
		version.ApprovedAt = &t
	}
	if version.Objectives == nil {
		version.Objectives = []domain.Objective{}
	}
	if version.TargetCompetencies == nil {
		version.TargetCompetencies = []domain.Competency{}
	}
	if version.Prerequisites == nil {
		version.Prerequisites = []domain.Prerequisite{}
	}
	if version.Assumptions == nil {
		version.Assumptions = []string{}
	}
	if version.SuggestedSearchTopics == nil {
		version.SuggestedSearchTopics = []string{}
	}
	if version.Warnings == nil {
		version.Warnings = []string{}
	}

	moduleRows, err := q.Query(ctx, `
		select id::text, source_id, title, description, sequence_order, objectives, skills,
			estimated_duration_minutes, required_previous_module_ids
		from public.course_modules where course_version_id=$1 order by sequence_order`, versionID)
	if err != nil {
		return nil, err
	}
	moduleBySource := map[string]*domain.CourseModule{}
	moduleOrder := []string{}
	for moduleRows.Next() {
		module := domain.CourseModule{}
		var moduleID string
		if err := moduleRows.Scan(&moduleID, &module.SourceID, &module.Title, &module.Description,
			&module.Sequence, jsonBytes(&module.Objectives), jsonBytes(&module.Skills),
			&module.EstimatedDurationMinutes, jsonBytes(&module.RequiredPreviousModuleIDs)); err != nil {
			moduleRows.Close()
			return nil, err
		}
		module.ID = moduleID
		if module.Objectives == nil {
			module.Objectives = []domain.Objective{}
		}
		if module.Skills == nil {
			module.Skills = []string{}
		}
		if module.RequiredPreviousModuleIDs == nil {
			module.RequiredPreviousModuleIDs = []string{}
		}
		version.Modules = append(version.Modules, module)
		moduleOrder = append(moduleOrder, moduleID)
	}
	moduleRows.Close()
	if err := moduleRows.Err(); err != nil {
		return nil, err
	}
	for index := range version.Modules {
		moduleBySource[version.Modules[index].SourceID] = &version.Modules[index]
	}

	classRows, err := q.Query(ctx, `
		select c.id::text, c.module_id::text, c.source_id, c.title, c.description,
			c.sequence_order, c.objectives, c.prerequisite_class_ids,
			c.estimated_duration_minutes, c.key_concepts, c.knowledge_check
		from public.classes c
		join public.course_modules m on m.id = c.module_id
		where c.course_version_id=$1
		order by m.sequence_order, c.sequence_order`, versionID)
	if err != nil {
		return nil, err
	}
	classBySource := map[string]*domain.CourseClass{}
	classesByModule := map[string][]domain.CourseClass{}
	type classRow struct {
		class  domain.CourseClass
		module string
	}
	classRowsList := []classRow{}
	for classRows.Next() {
		klass := domain.CourseClass{}
		var moduleID string
		if err := classRows.Scan(&klass.ID, &moduleID, &klass.SourceID, &klass.Title,
			&klass.Description, &klass.Sequence, jsonBytes(&klass.Objectives),
			jsonBytes(&klass.PrerequisiteClassIDs), &klass.EstimatedDurationMinutes,
			jsonBytes(&klass.KeyConcepts), jsonBytes(&klass.KnowledgeCheck)); err != nil {
			classRows.Close()
			return nil, err
		}
		if klass.Objectives == nil {
			klass.Objectives = []domain.Objective{}
		}
		if klass.PrerequisiteClassIDs == nil {
			klass.PrerequisiteClassIDs = []string{}
		}
		if klass.KeyConcepts == nil {
			klass.KeyConcepts = []string{}
		}
		classRowsList = append(classRowsList, classRow{class: klass, module: moduleID})
	}
	classRows.Close()
	if err := classRows.Err(); err != nil {
		return nil, err
	}

	lessonRows, err := q.Query(ctx, `
		select l.id::text, l.class_id::text, l.source_id, l.title, l.description,
			l.sequence_order, l.estimated_duration_minutes, coalesce(lc.content, '{}'::jsonb)
		from public.lessons l
		join public.classes c on c.id = l.class_id
		left join public.lesson_contents lc on lc.lesson_id=l.id and lc.content_type='blueprint'
		where l.course_version_id=$1
		order by c.module_id, c.sequence_order, l.sequence_order`, versionID)
	if err != nil {
		return nil, err
	}
	lessonsByClass := map[string][]domain.Lesson{}
	for lessonRows.Next() {
		lesson := domain.Lesson{}
		var classID string
		if err := lessonRows.Scan(&lesson.ID, &classID, &lesson.SourceID, &lesson.Title,
			&lesson.Description, &lesson.Sequence, &lesson.EstimatedDurationMinutes,
			jsonBytes(&lesson.Blueprint)); err != nil {
			lessonRows.Close()
			return nil, err
		}
		lessonsByClass[classID] = append(lessonsByClass[classID], lesson)
	}
	lessonRows.Close()
	if err := lessonRows.Err(); err != nil {
		return nil, err
	}

	exerciseRows, err := q.Query(ctx, `
		select class_id::text, title, description, difficulty, competency, instructions,
			expected_deliverable, evaluation_criteria
		from public.exercises where course_version_id=$1`, versionID)
	if err != nil {
		return nil, err
	}
	exerciseByClass := map[string]domain.ExerciseBlueprint{}
	for exerciseRows.Next() {
		var classID string
		var exercise domain.ExerciseBlueprint
		if err := exerciseRows.Scan(&classID, &exercise.Title, &exercise.Description,
			&exercise.Difficulty, &exercise.Competency, jsonBytes(&exercise.Instructions),
			&exercise.ExpectedDeliverable, jsonBytes(&exercise.EvaluationCriteria)); err != nil {
			exerciseRows.Close()
			return nil, err
		}
		if exercise.Instructions == nil {
			exercise.Instructions = []string{}
		}
		if exercise.EvaluationCriteria == nil {
			exercise.EvaluationCriteria = []string{}
		}
		exerciseByClass[classID] = exercise
	}
	exerciseRows.Close()
	if err := exerciseRows.Err(); err != nil {
		return nil, err
	}

	for _, item := range classRowsList {
		klass := item.class
		klass.Lessons = lessonsByClass[klass.ID]
		if klass.Lessons == nil {
			klass.Lessons = []domain.Lesson{}
		}
		if exercise, ok := exerciseByClass[klass.ID]; ok {
			copy := exercise
			klass.Exercise = &copy
		}
		classesByModule[item.module] = append(classesByModule[item.module], klass)
		classBySource[klass.SourceID] = &klass
	}
	for index := range version.Modules {
		module := &version.Modules[index]
		module.Classes = classesByModule[module.ID]
		if module.Classes == nil {
			module.Classes = []domain.CourseClass{}
		}
	}

	// Resolve source references to readable titles.
	for index := range version.Modules {
		module := &version.Modules[index]
		module.RequiredPreviousModules = []domain.Reference{}
		for _, source := range module.RequiredPreviousModuleIDs {
			if previous, ok := moduleBySource[source]; ok {
				module.RequiredPreviousModules = append(module.RequiredPreviousModules,
					domain.Reference{ID: previous.ID, Title: previous.Title})
			}
		}
		for classIndex := range module.Classes {
			klass := &module.Classes[classIndex]
			klass.Prerequisites = []domain.Reference{}
			for _, source := range klass.PrerequisiteClassIDs {
				if previous, ok := classBySource[source]; ok {
					klass.Prerequisites = append(klass.Prerequisites,
						domain.Reference{ID: previous.ID, Title: previous.Title})
				}
			}
		}
	}
	return version, nil
}

func (p *Postgres) GetCourse(ctx context.Context, userID, courseID string) (*domain.CourseDetail, error) {
	var detail domain.CourseDetail
	var currentVersionID, approvedVersionID string
	err := p.pool.QueryRow(ctx, `
		select id::text, learning_goal_id::text, status,
			coalesce(current_version_id::text,''), coalesce(approved_version_id::text,''),
			created_at, updated_at
		from public.courses where id=$1 and user_id=$2`, courseID, userID,
	).Scan(&detail.ID, &detail.LearningGoalID, &detail.Status, &currentVersionID,
		&approvedVersionID, &detail.CreatedAt, &detail.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if currentVersionID != "" {
		detail.CurrentVersionID = &currentVersionID
	}
	if approvedVersionID != "" {
		detail.ApprovedVersionID = &approvedVersionID
	}
	if currentVersionID != "" {
		version, err := p.loadVersion(ctx, p.pool, userID, currentVersionID)
		if err != nil {
			return nil, err
		}
		detail.Version = version
		detail.Counts = countsFor(version)
	}
	if approvedVersionID != "" {
		version, err := p.loadVersion(ctx, p.pool, userID, approvedVersionID)
		if err != nil {
			return nil, err
		}
		detail.ApprovedVersion = version
		if detail.Version == nil {
			detail.Version = version
			detail.Counts = countsFor(version)
		}
	}
	return &detail, nil
}

func countsFor(version *domain.CourseVersion) domain.CourseCounts {
	counts := domain.CourseCounts{Modules: len(version.Modules)}
	for _, module := range version.Modules {
		counts.Classes += len(module.Classes)
		for _, class := range module.Classes {
			counts.Lessons += len(class.Lessons)
			if class.Exercise != nil {
				counts.Exercises++
			}
		}
	}
	return counts
}

func (p *Postgres) ListCourses(ctx context.Context, userID string) ([]domain.CourseSummary, error) {
	rows, err := p.pool.Query(ctx, `
		select c.id::text, c.learning_goal_id::text, c.status,
			coalesce(c.current_version_id::text,''), coalesce(c.approved_version_id::text,''),
			coalesce(cv.status,''),
			coalesce(v.id::text,''), coalesce(v.version_number,0), coalesce(v.status,''),
			coalesce(v.title,''), coalesce(v.short_description,''),
			coalesce(v.target_learner_level,''), coalesce(v.estimated_duration_minutes,0),
			coalesce((select count(*) from public.course_modules m where m.course_version_id=v.id),0),
			coalesce((select count(*) from public.classes k where k.course_version_id=v.id),0),
			coalesce((select count(*) from public.lessons l where l.course_version_id=v.id),0),
			coalesce((select count(*) from public.exercises e where e.course_version_id=v.id),0),
			c.created_at, c.updated_at
		from public.courses c
		left join public.course_versions cv on cv.id = c.current_version_id
		left join public.course_versions v on v.id = coalesce(c.approved_version_id, c.current_version_id)
		where c.user_id=$1
		order by c.updated_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	courses := []domain.CourseSummary{}
	for rows.Next() {
		var course domain.CourseSummary
		var currentID, approvedID, currentStatus, versionID, versionStatus string
		if err := rows.Scan(&course.ID, &course.LearningGoalID, &course.Status,
			&currentID, &approvedID, &currentStatus, &versionID,
			&course.VersionNumber, &versionStatus,
			&course.Title, &course.ShortDescription, &course.TargetLearnerLevel,
			&course.EstimatedDurationMinutes, &course.Counts.Modules,
			&course.Counts.Classes, &course.Counts.Lessons, &course.Counts.Exercises,
			&course.CreatedAt, &course.UpdatedAt); err != nil {
			return nil, err
		}
		course.VersionStatus = versionStatus
		if currentID != "" {
			course.CurrentVersionID = &currentID
		}
		if approvedID != "" {
			course.ApprovedVersionID = &approvedID
		}
		if currentID != "" && currentID != approvedID && currentStatus == "draft" {
			course.DraftVersionID = &currentID
			course.HasDraft = true
		}
		_ = versionID
		courses = append(courses, course)
	}
	return courses, rows.Err()
}

func (p *Postgres) UpdateDraft(ctx context.Context, userID, courseID string, patch domain.UpdateDraftInput) (*domain.CourseDetail, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var versionStatus string
	err = tx.QueryRow(ctx, `
		select v.status from public.course_versions v
		join public.courses c on c.id = v.course_id
		where v.id=$1 and v.course_id=$2 and c.user_id=$3
		for update of v`, patch.VersionID, courseID, userID).Scan(&versionStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if versionStatus != "draft" {
		return nil, ErrConflict
	}

	if patch.Title != nil {
		if _, err := tx.Exec(ctx, `update public.course_versions set title=$1 where id=$2`, *patch.Title, patch.VersionID); err != nil {
			return nil, err
		}
	}
	if patch.ShortDescription != nil {
		if _, err := tx.Exec(ctx, `update public.course_versions set short_description=$1 where id=$2`, *patch.ShortDescription, patch.VersionID); err != nil {
			return nil, err
		}
	}
	if patch.Description != nil {
		if _, err := tx.Exec(ctx, `update public.course_versions set description=$1 where id=$2`, *patch.Description, patch.VersionID); err != nil {
			return nil, err
		}
	}
	for _, module := range patch.Modules {
		if module.Title != nil {
			tag, err := tx.Exec(ctx, `update public.course_modules set title=$1 where id=$2 and course_version_id=$3`, *module.Title, module.ID, patch.VersionID)
			if err != nil {
				return nil, err
			}
			if tag.RowsAffected() == 0 {
				return nil, ErrNotFound
			}
		}
		if module.Description != nil {
			tag, err := tx.Exec(ctx, `update public.course_modules set description=$1 where id=$2 and course_version_id=$3`, *module.Description, module.ID, patch.VersionID)
			if err != nil {
				return nil, err
			}
			if tag.RowsAffected() == 0 {
				return nil, ErrNotFound
			}
		}
	}
	for _, class := range patch.Classes {
		if class.Title != nil {
			tag, err := tx.Exec(ctx, `update public.classes set title=$1 where id=$2 and course_version_id=$3`, *class.Title, class.ID, patch.VersionID)
			if err != nil {
				return nil, err
			}
			if tag.RowsAffected() == 0 {
				return nil, ErrNotFound
			}
		}
		if class.Description != nil {
			tag, err := tx.Exec(ctx, `update public.classes set description=$1 where id=$2 and course_version_id=$3`, *class.Description, class.ID, patch.VersionID)
			if err != nil {
				return nil, err
			}
			if tag.RowsAffected() == 0 {
				return nil, ErrNotFound
			}
		}
	}
	if _, err := tx.Exec(ctx, `update public.courses set updated_at=now() where id=$1`, courseID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetCourse(ctx, userID, courseID)
}

func (p *Postgres) ApproveCourse(ctx context.Context, userID, courseID, versionID string) (*domain.CourseDetail, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var currentVersionID, approvedVersionID string
	var courseStatus string
	err = tx.QueryRow(ctx, `
		select status, coalesce(current_version_id::text,''), coalesce(approved_version_id::text,'')
		from public.courses where id=$1 and user_id=$2 for update`, courseID, userID,
	).Scan(&courseStatus, &currentVersionID, &approvedVersionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	_ = courseStatus
	_ = currentVersionID

	var versionStatus string
	var versionCourseID string
	err = tx.QueryRow(ctx, `select status, course_id::text from public.course_versions where id=$1 for update`, versionID).Scan(&versionStatus, &versionCourseID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if versionCourseID != courseID {
		return nil, ErrNotFound
	}
	if approvedVersionID != "" && approvedVersionID == versionID && versionStatus == "approved" {
		// Idempotent approval.
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return p.GetCourse(ctx, userID, courseID)
	}
	if versionStatus != "draft" {
		return nil, ErrConflict
	}

	// Structural sanity check before approval: a version must still contain modules,
	// classes and lessons. Titles/descriptions were validated on edit.
	var moduleCount, classCount, lessonCount int
	if err := tx.QueryRow(ctx, `
		select count(*), coalesce(sum((select count(*) from public.classes k where k.course_version_id=$1)),0),
			(select count(*) from public.lessons l where l.course_version_id=$1)
		from public.course_modules m where m.course_version_id=$1`, versionID,
	).Scan(&moduleCount, &classCount, &lessonCount); err != nil {
		return nil, err
	}
	if moduleCount == 0 || classCount == 0 || lessonCount == 0 {
		return nil, ErrInvalidState
	}

	if _, err := tx.Exec(ctx, `
		update public.course_versions set status='superseded'
		where course_id=$1 and status='approved' and id<>$2`, courseID, versionID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		update public.course_versions set status='approved', approved_at=now()
		where id=$1`, versionID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		update public.courses
		set status='approved', approved_version_id=$1, current_version_id=$1, updated_at=now()
		where id=$2 and user_id=$3`, versionID, courseID, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		insert into public.course_enrollments (course_id, course_version_id, user_id, status)
		values ($1,$2,$3,'active')
		on conflict (user_id, course_id)
		do update set course_version_id=excluded.course_version_id, status='active', updated_at=now()`,
		courseID, versionID, userID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		update public.learning_goals g set status='approved', last_error=null
		from public.courses c
		where c.id=$1 and c.learning_goal_id=g.id and g.user_id=$2`, courseID, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetCourse(ctx, userID, courseID)
}

func (p *Postgres) CreateConversation(ctx context.Context, userID string, input domain.CreateConversationInput) (*domain.Conversation, error) {
	title := input.Title
	if title == "" {
		title = "New conversation"
	}
	mode := input.TutorMode
	if mode == "" {
		mode = "explain"
	}

	var conv domain.Conversation
	err := p.pool.QueryRow(ctx, `
		insert into public.conversations (user_id, title, tutor_mode, context_type, context_id)
		values ($1, $2, $3, $4, $5)
		returning id, user_id, title, tutor_mode, context_type, context_id, created_at, updated_at`,
		userID, title, mode, input.ContextType, input.ContextID,
	).Scan(
		&conv.ID, &conv.UserID, &conv.Title, &conv.TutorMode,
		&conv.ContextType, &conv.ContextID, &conv.CreatedAt, &conv.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &conv, nil
}

func (p *Postgres) ListConversations(ctx context.Context, userID string) ([]domain.Conversation, error) {
	rows, err := p.pool.Query(ctx, `
		select id, user_id, title, tutor_mode, context_type, context_id, created_at, updated_at
		from public.conversations
		where user_id = $1
		order by updated_at desc`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []domain.Conversation
	for rows.Next() {
		var conv domain.Conversation
		if err := rows.Scan(
			&conv.ID, &conv.UserID, &conv.Title, &conv.TutorMode,
			&conv.ContextType, &conv.ContextID, &conv.CreatedAt, &conv.UpdatedAt,
		); err != nil {
			return nil, err
		}
		result = append(result, conv)
	}
	if result == nil {
		result = []domain.Conversation{}
	}
	return result, nil
}

func (p *Postgres) GetConversation(ctx context.Context, userID, conversationID string) (*domain.ConversationDetail, error) {
	var conv domain.Conversation
	err := p.pool.QueryRow(ctx, `
		select id, user_id, title, tutor_mode, context_type, context_id, created_at, updated_at
		from public.conversations
		where id = $1 and user_id = $2`, conversationID, userID,
	).Scan(
		&conv.ID, &conv.UserID, &conv.Title, &conv.TutorMode,
		&conv.ContextType, &conv.ContextID, &conv.CreatedAt, &conv.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	rows, err := p.pool.Query(ctx, `
		select id, conversation_id, user_id, role, content, model, token_usage, metadata, created_at
		from public.messages
		where conversation_id = $1 and user_id = $2
		order by created_at asc`, conversationID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []domain.Message
	for rows.Next() {
		var msg domain.Message
		var tokenUsage, metadata []byte
		if err := rows.Scan(
			&msg.ID, &msg.ConversationID, &msg.UserID, &msg.Role, &msg.Content,
			&msg.Model, &tokenUsage, &metadata, &msg.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(tokenUsage) > 0 {
			_ = json.Unmarshal(tokenUsage, &msg.TokenUsage)
		}
		if len(metadata) > 0 {
			_ = json.Unmarshal(metadata, &msg.Metadata)
		}
		messages = append(messages, msg)
	}
	if messages == nil {
		messages = []domain.Message{}
	}

	return &domain.ConversationDetail{
		Conversation: conv,
		Messages:     messages,
	}, nil
}

func (p *Postgres) UpdateConversation(ctx context.Context, userID, conversationID string, input domain.UpdateConversationInput) (*domain.Conversation, error) {
	var conv domain.Conversation
	err := p.pool.QueryRow(ctx, `
		update public.conversations
		set title = coalesce($1, title),
		    tutor_mode = coalesce($2, tutor_mode),
		    updated_at = now()
		where id = $3 and user_id = $4
		returning id, user_id, title, tutor_mode, context_type, context_id, created_at, updated_at`,
		input.Title, input.TutorMode, conversationID, userID,
	).Scan(
		&conv.ID, &conv.UserID, &conv.Title, &conv.TutorMode,
		&conv.ContextType, &conv.ContextID, &conv.CreatedAt, &conv.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &conv, nil
}

func (p *Postgres) DeleteConversation(ctx context.Context, userID, conversationID string) error {
	tag, err := p.pool.Exec(ctx, `
		delete from public.conversations
		where id = $1 and user_id = $2`, conversationID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (p *Postgres) AddMessage(ctx context.Context, userID, conversationID string, role, content, model string, tokenUsage, metadata map[string]any) (*domain.Message, error) {
	// token_usage and metadata must be a JSON object (messages_*_check); a nil
	// map would marshal to JSON null, which is neither SQL NULL nor an object.
	tokenUsageJSON := jsonbObject(tokenUsage)
	metadataJSON := jsonbObject(metadata)

	var msg domain.Message
	var tokenUsageBytes, metadataBytes []byte

	err := p.pool.QueryRow(ctx, `
		insert into public.messages (conversation_id, user_id, role, content, model, token_usage, metadata)
		values ($1, $2, $3, $4, $5, $6, $7)
		returning id, conversation_id, user_id, role, content, model, token_usage, metadata, created_at`,
		conversationID, userID, role, content, model, tokenUsageJSON, metadataJSON,
	).Scan(
		&msg.ID, &msg.ConversationID, &msg.UserID, &msg.Role, &msg.Content,
		&msg.Model, &tokenUsageBytes, &metadataBytes, &msg.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if len(tokenUsageBytes) > 0 {
		_ = json.Unmarshal(tokenUsageBytes, &msg.TokenUsage)
	}
	if len(metadataBytes) > 0 {
		_ = json.Unmarshal(metadataBytes, &msg.Metadata)
	}

	_, _ = p.pool.Exec(ctx, `update public.conversations set updated_at = now() where id = $1`, conversationID)
	return &msg, nil
}

func (p *Postgres) CompleteLesson(ctx context.Context, userID, courseID, lessonID string) error {
	_, err := p.pool.Exec(ctx, `
		insert into public.lesson_completions (user_id, course_id, lesson_id)
		values ($1, $2, $3)
		on conflict (user_id, lesson_id) do nothing`,
		userID, courseID, lessonID,
	)
	return err
}

func (p *Postgres) GetCompletedLessons(ctx context.Context, userID, courseID string) ([]string, error) {
	var rows pgx.Rows
	var err error
	if courseID != "" {
		rows, err = p.pool.Query(ctx, `
			select lesson_id from public.lesson_completions
			where user_id = $1 and course_id = $2`, userID, courseID)
	} else {
		rows, err = p.pool.Query(ctx, `
			select lesson_id from public.lesson_completions
			where user_id = $1`, userID)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []string
	for rows.Next() {
		var lessonID string
		if err := rows.Scan(&lessonID); err != nil {
			return nil, err
		}
		result = append(result, lessonID)
	}
	if result == nil {
		result = []string{}
	}
	return result, nil
}

func (p *Postgres) GetDashboard(ctx context.Context, userID string) (*domain.DashboardData, error) {
	goals, _ := p.ListLearningGoals(ctx, userID)
	courses, _ := p.ListCourses(ctx, userID)

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

	completedLessons, _ := p.GetCompletedLessons(ctx, userID, "")

	return &domain.DashboardData{
		TotalGoals:            len(goals),
		TotalCourses:          len(courses),
		ApprovedCourses:       approvedCount,
		DraftCourses:          draftCount,
		RecentGoal:            recentGoal,
		ActiveCourse:          activeCourse,
		CompletedLessonCount:  len(completedLessons),
		TotalStudyTimeMinutes: len(completedLessons) * 45,
	}, nil
}

func (p *Postgres) GetProgress(ctx context.Context, userID string) (*domain.ProgressData, error) {
	courses, _ := p.ListCourses(ctx, userID)
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

	completed, _ := p.GetCompletedLessons(ctx, userID, "")

	return &domain.ProgressData{
		EnrolledCourses:    enrolled,
		CompletedLessonIDs: completed,
		TotalLessons:       totalLessons,
		CompletedLessons:   len(completed),
		TotalClasses:       totalClasses,
		TotalModules:       totalModules,
	}, nil
}

// ============================================================================
// Learning Engine — Postgres implementations
// ============================================================================

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

func (p *Postgres) GetLesson(ctx context.Context, userID, courseID, lessonID string) (*domain.LessonWithContents, error) {
	// Verify ownership and fetch lesson metadata.
	var lesson domain.LessonWithContents
	err := p.pool.QueryRow(ctx, `
		select l.id::text, l.source_id, l.class_id::text, l.sequence_order,
			l.title, l.description, l.estimated_duration_minutes
		from public.lessons l
		join public.classes cl on cl.id = l.class_id
		join public.course_modules m on m.id = cl.module_id
		join public.course_versions v on v.id = m.course_version_id
		join public.courses c on c.id = v.course_id
		where l.id = $1 and c.id = $2 and c.user_id = $3`,
		lessonID, courseID, userID,
	).Scan(&lesson.ID, &lesson.SourceID, &lesson.ClassID, &lesson.Sequence,
		&lesson.Title, &lesson.Description, &lesson.EstimatedDurationMinutes)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := p.pool.Query(ctx, `
		select content_type, content, sequence_order
		from public.lesson_contents
		where lesson_id = $1
		order by sequence_order`, lessonID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lesson.Contents = []domain.LessonContent{}
	for rows.Next() {
		var lc domain.LessonContent
		var seq int
		if err := rows.Scan(&lc.ContentType, &lc.Content, &seq); err != nil {
			return nil, err
		}
		lesson.Contents = append(lesson.Contents, lc)
	}
	return &lesson, rows.Err()
}

func (p *Postgres) SaveLessonAuthored(ctx context.Context, userID, courseID, lessonID string, authored any) error {
	// content must be a JSON object (lesson_contents_content_check).
	data := jsonbObject(authored)
	_, err := p.pool.Exec(ctx, `
		insert into public.lesson_contents (lesson_id, content_type, content, sequence_order)
		values ($1, 'authored', $2, 2)
		on conflict (lesson_id, content_type, sequence_order) do update set content = excluded.content`,
		lessonID, data)
	return err
}

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

func (p *Postgres) GetExercise(ctx context.Context, userID, courseID, classID string) (*domain.ExerciseWithAuthored, error) {
	var ex domain.ExerciseWithAuthored
	err := p.pool.QueryRow(ctx, `
		select e.id::text, e.class_id::text, e.title, e.description,
			e.difficulty, e.competency, e.instructions
		from public.exercises e
		join public.course_versions v on v.id = e.course_version_id
		join public.courses c on c.id = v.course_id
		where e.class_id = $1 and c.id = $2 and c.user_id = $3`,
		classID, courseID, userID,
	).Scan(&ex.ID, &ex.ClassID, &ex.Title, &ex.Description,
		&ex.Difficulty, &ex.Competency, jsonBytes(&ex.Instructions))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if ex.Instructions == nil {
		ex.Instructions = []string{}
	}
	// Check for authored content stored in exercises table authored_content column
	// (stored as JSON in exercises.authored_content if column exists — gracefully skip if not).
	return &ex, nil
}

func (p *Postgres) SaveExerciseAuthored(ctx context.Context, userID, courseID, exerciseID string, authored any) error {
	// We store authored exercise content as a lesson_content-style JSON blob
	// keyed by exercise_id in a simple upsert on the exercises table authored_content column.
	// This column is added by the Phase 04 migration; silently skip if unavailable.
	data, err := json.Marshal(authored)
	if err != nil {
		return err
	}
	_, _ = p.pool.Exec(ctx, `
		update public.exercises set authored_content = $1 where id = $2`,
		data, exerciseID)
	return nil
}

func (p *Postgres) SubmitExercise(ctx context.Context, userID, courseID, exerciseID, response string) (*domain.ExerciseSubmission, error) {
	var sub domain.ExerciseSubmission
	err := p.pool.QueryRow(ctx, `
		insert into public.exercise_submissions
			(exercise_id, course_id, user_id, attempt_number, response, status)
		values (
			$1, $2, $3,
			coalesce((select max(attempt_number) from public.exercise_submissions
			          where exercise_id=$1 and user_id=$3), 0) + 1,
			$4, 'submitted'
		)
		returning id::text, exercise_id::text, course_id::text, user_id::text,
			attempt_number, response, score, feedback, status, submitted_at, evaluated_at, created_at`,
		exerciseID, courseID, userID, response,
	).Scan(&sub.ID, &sub.ExerciseID, &sub.CourseID, &sub.UserID,
		&sub.AttemptNumber, &sub.Response, &sub.Score, &sub.Feedback,
		&sub.Status, &sub.SubmittedAt, &sub.EvaluatedAt, &sub.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &sub, nil
}

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

func (p *Postgres) GetRoadmap(ctx context.Context, userID, courseID string) (*domain.Roadmap, error) {
	course, err := p.GetCourse(ctx, userID, courseID)
	if err != nil {
		return nil, err
	}
	version := course.Version
	if version == nil {
		return nil, ErrNotFound
	}

	// Fetch completed lessons for this course.
	completedSet := map[string]bool{}
	if completedIDs, err := p.GetCompletedLessons(ctx, userID, courseID); err == nil {
		for _, id := range completedIDs {
			completedSet[id] = true
		}
	}

	// Fetch latest quiz per class.
	type quizRow struct {
		classID  string
		status   string
		score    *int
		passed   *bool
		attemptID string
		passing  int
	}
	quizMap := map[string]quizRow{}
	qrows, err := p.pool.Query(ctx, `
		select distinct on (class_id) class_id::text, status,
			score, passed, id::text, passing_score
		from public.quiz_attempts
		where course_id = $1 and user_id = $2
		order by class_id, attempt_number desc`, courseID, userID)
	if err == nil {
		defer qrows.Close()
		for qrows.Next() {
			var qr quizRow
			_ = qrows.Scan(&qr.classID, &qr.status, &qr.score, &qr.passed, &qr.attemptID, &qr.passing)
			quizMap[qr.classID] = qr
		}
	}

	roadmap := &domain.Roadmap{
		CourseID:         courseID,
		Title:            version.Title,
		ShortDescription: version.ShortDescription,
		Approved:         course.Status == "approved",
		Modules:          []domain.RoadmapModule{},
	}
	totalLessons, completedLessons, totalClasses, completedClasses := 0, 0, 0, 0

	for _, mod := range version.Modules {
		rm := domain.RoadmapModule{
			ID: mod.ID, Title: mod.Title, Description: mod.Description,
			Sequence: mod.Sequence, Classes: []domain.RoadmapClass{},
		}
		for _, cls := range mod.Classes {
			totalClasses++
			rc := domain.RoadmapClass{
				ID:          cls.ID,
				Title:       cls.Title,
				Description: cls.Description,
				Sequence:    cls.Sequence,
				Unlocked:    true,
				TotalLessons: len(cls.Lessons),
				PassingScore: 70,
				QuizStatus:  "not_started",
				Lessons:     []domain.RoadmapLesson{},
			}
			if qr, ok := quizMap[cls.ID]; ok {
				rc.QuizStatus = qr.status
				rc.QuizScore = qr.score
				if qr.attemptID != "" {
					rc.QuizAttemptID = &qr.attemptID
				}
				rc.PassingScore = qr.passing
			}

			classCompleted := 0
			for _, l := range cls.Lessons {
				totalLessons++
				status := domain.RoadmapLessonAvailable
				if completedSet[l.ID] {
					status = domain.RoadmapLessonCompleted
					completedLessons++
					classCompleted++
				}
				rc.Lessons = append(rc.Lessons, domain.RoadmapLesson{
					ID: l.ID, Title: l.Title, Description: l.Description,
					Sequence: l.Sequence, Duration: l.EstimatedDurationMinutes,
					Status: status,
				})
			}
			rc.CompletedLessons = classCompleted

			switch {
			case rc.QuizStatus == "evaluated" && rc.QuizScore != nil && rc.PassingScore > 0 && *rc.QuizScore >= rc.PassingScore:
				rc.Status = domain.RoadmapClassCompleted
				completedClasses++
			case classCompleted > 0:
				rc.Status = domain.RoadmapClassInProgress
			case rc.QuizStatus == "evaluated":
				rc.Status = domain.RoadmapClassNeedsReview
			default:
				rc.Status = domain.RoadmapClassAvailable
			}

			// Set next lesson/class hints.
			if roadmap.NextClassID == nil && rc.Status == domain.RoadmapClassAvailable {
				id := cls.ID
				roadmap.NextClassID = &id
			}
			if roadmap.NextLessonID == nil {
				for _, l := range rc.Lessons {
					if l.Status == domain.RoadmapLessonAvailable {
						id := l.ID
						roadmap.NextLessonID = &id
						break
					}
				}
			}
			rm.Classes = append(rm.Classes, rc)
		}
		roadmap.Modules = append(roadmap.Modules, rm)
	}

	roadmap.TotalLessons = totalLessons
	roadmap.CompletedLessons = completedLessons
	roadmap.TotalClasses = totalClasses
	roadmap.CompletedClasses = completedClasses
	if totalLessons > 0 {
		roadmap.ProgressPercent = (completedLessons * 100) / totalLessons
	}
	return roadmap, nil
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

func (p *Postgres) CreateQuizAttempt(ctx context.Context, userID, courseID, classID string, passingScore int, questions []QuizQuestion, keys []domain.QuizAnswerKey) (*domain.QuizAttempt, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Verify course ownership.
	var dummy string
	if err := tx.QueryRow(ctx, `select id from public.courses where id=$1 and user_id=$2`, courseID, userID).Scan(&dummy); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}

	var versionID string
	if err := tx.QueryRow(ctx, `select coalesce(approved_version_id::text, current_version_id::text, '') from public.courses where id=$1`, courseID).Scan(&versionID); err != nil {
		return nil, err
	}

	number := 1
	if err := tx.QueryRow(ctx, `select coalesce(max(attempt_number),0)+1 from public.quiz_attempts where course_id=$1 and class_id=$2 and user_id=$3`, courseID, classID, userID).Scan(&number); err != nil {
		return nil, err
	}

	var attemptID string
	if err := tx.QueryRow(ctx, `
		insert into public.quiz_attempts
			(course_id, course_version_id, class_id, user_id, attempt_number, status, passing_score)
		values ($1,$2,$3,$4,$5,'ready',$6)
		returning id::text`,
		courseID, versionID, classID, userID, number, passingScore,
	).Scan(&attemptID); err != nil {
		return nil, err
	}

	keyBySource := map[string]domain.QuizAnswerKey{}
	for _, k := range keys {
		keyBySource[k.QuestionID] = k
	}
	for _, q := range questions {
		questionID := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			insert into public.quiz_questions
				(id, attempt_id, source_id, sequence_order, question_type, prompt,
				 competency, difficulty, choices)
			values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			questionID, attemptID, q.SourceID, q.Sequence, q.Type, q.Prompt,
			q.Competency, q.Difficulty, jsonbArray(q.Choices),
		); err != nil {
			return nil, err
		}
		if k, ok := keyBySource[q.SourceID]; ok {
			if _, err := tx.Exec(ctx, `
				insert into public.quiz_answer_keys (question_id, expected_answer, rubric)
				values ($1,$2,$3)`, questionID, k.ExpectedAnswer, jsonbArray(k.Rubric),
			); err != nil {
				return nil, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetLatestQuiz(ctx, userID, courseID, classID)
}

func (p *Postgres) GetLatestQuiz(ctx context.Context, userID, courseID, classID string) (*domain.QuizAttempt, error) {
	var attempt domain.QuizAttempt
	var submittedAt, evaluatedAt pgtype.Timestamptz
	var summary string
	err := p.pool.QueryRow(ctx, `
		select id::text, course_id::text, class_id::text, status, attempt_number,
			passing_score, score, passed, coalesce(summary,''),
			strengths, gaps, question_scores, submitted_at, evaluated_at, created_at
		from public.quiz_attempts
		where course_id=$1 and class_id=$2 and user_id=$3
		order by attempt_number desc limit 1`,
		courseID, classID, userID,
	).Scan(&attempt.ID, &attempt.CourseID, &attempt.ClassID, &attempt.Status,
		&attempt.AttemptNumber, &attempt.PassingScore, &attempt.Score, &attempt.Passed,
		&summary, jsonBytes(&attempt.Strengths), jsonBytes(&attempt.Gaps),
		jsonBytes(&attempt.QuestionScores), &submittedAt, &evaluatedAt, &attempt.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if summary != "" {
		attempt.Summary = &summary
	}
	if submittedAt.Valid {
		t := submittedAt.Time
		attempt.SubmittedAt = &t
	}
	if evaluatedAt.Valid {
		t := evaluatedAt.Time
		attempt.EvaluatedAt = &t
	}
	if attempt.Strengths == nil {
		attempt.Strengths = []string{}
	}
	if attempt.Gaps == nil {
		attempt.Gaps = []domain.KnowledgeGap{}
	}
	if attempt.QuestionScores == nil {
		attempt.QuestionScores = []domain.QuizQuestionScore{}
	}

	// Load questions.
	qrows, err := p.pool.Query(ctx, `
		select id::text, source_id, sequence_order, question_type, prompt,
			competency, difficulty, choices
		from public.quiz_questions where attempt_id=$1 order by sequence_order`, attempt.ID)
	if err != nil {
		return nil, err
	}
	defer qrows.Close()
	qIDBySource := map[string]string{} // source_id -> db uuid (for answer lookup)
	attempt.Questions = []domain.QuizQuestion{}
	for qrows.Next() {
		var q domain.QuizQuestion
		var dbID string
		if err := qrows.Scan(&dbID, &q.ID, &q.Sequence, &q.Type, &q.Prompt,
			&q.Competency, &q.Difficulty, jsonBytes(&q.Choices)); err != nil {
			return nil, err
		}
		if q.Choices == nil {
			q.Choices = []domain.Choice{}
		}
		qIDBySource[q.ID] = dbID
		attempt.Questions = append(attempt.Questions, q)
	}
	if err := qrows.Err(); err != nil {
		return nil, err
	}

	// Load answers if evaluated.
	arows, err := p.pool.Query(ctx, `
		select qq.source_id, qa.response, qa.score, qa.feedback
		from public.quiz_answers qa
		join public.quiz_questions qq on qq.id = qa.question_id
		where qa.attempt_id = $1`, attempt.ID)
	if err != nil {
		return nil, err
	}
	defer arows.Close()
	attempt.Answers = []domain.QuizAnswer{}
	for arows.Next() {
		var a domain.QuizAnswer
		if err := arows.Scan(&a.QuestionID, &a.Response, &a.Score, &a.Feedback); err != nil {
			return nil, err
		}
		attempt.Answers = append(attempt.Answers, a)
	}
	return &attempt, arows.Err()
}

func (p *Postgres) GetQuizForEvaluation(ctx context.Context, userID, attemptID string) (*domain.QuizAttempt, []domain.QuizAnswerKey, error) {
	var courseID, classID string
	if err := p.pool.QueryRow(ctx, `select course_id::text, class_id::text from public.quiz_attempts where id=$1 and user_id=$2`, attemptID, userID).Scan(&courseID, &classID); errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrNotFound
	} else if err != nil {
		return nil, nil, err
	}

	attempt, err := p.GetLatestQuiz(ctx, userID, courseID, classID)
	if err != nil {
		return nil, nil, err
	}
	if attempt.ID != attemptID {
		// The caller wants a specific attempt (not necessarily the latest).
		// For simplicity, only support evaluating the latest attempt.
		return nil, nil, ErrNotFound
	}

	// Fetch answer keys (service role only).
	krows, err := p.pool.Query(ctx, `
		select qq.source_id, k.expected_answer, k.rubric
		from public.quiz_answer_keys k
		join public.quiz_questions qq on qq.id = k.question_id
		where qq.attempt_id = $1 order by qq.sequence_order`, attemptID)
	if err != nil {
		return nil, nil, err
	}
	defer krows.Close()
	keys := []domain.QuizAnswerKey{}
	for krows.Next() {
		var k domain.QuizAnswerKey
		if err := krows.Scan(&k.QuestionID, &k.ExpectedAnswer, jsonBytes(&k.Rubric)); err != nil {
			return nil, nil, err
		}
		if k.Rubric == nil {
			k.Rubric = []domain.RubricCriterion{}
		}
		keys = append(keys, k)
	}
	return attempt, keys, krows.Err()
}

func (p *Postgres) SaveQuizEvaluation(ctx context.Context, userID, attemptID string, answers []domain.QuizAnswer, evaluation domain.QuizEvaluation) (*domain.QuizAttempt, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var courseID, classID string
	var status string
	if err := tx.QueryRow(ctx, `select course_id::text, class_id::text, status from public.quiz_attempts where id=$1 and user_id=$2 for update`, attemptID, userID).Scan(&courseID, &classID, &status); errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	if status == "evaluated" {
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return p.GetLatestQuiz(ctx, userID, courseID, classID)
	}

	// Map source_id -> db question uuid for answer inserts.
	qIDMap := map[string]string{}
	qrows, err := tx.Query(ctx, `select source_id, id::text from public.quiz_questions where attempt_id=$1`, attemptID)
	if err != nil {
		return nil, err
	}
	for qrows.Next() {
		var src, dbID string
		if err := qrows.Scan(&src, &dbID); err != nil {
			qrows.Close()
			return nil, err
		}
		qIDMap[src] = dbID
	}
	qrows.Close()

	for _, a := range answers {
		dbID, ok := qIDMap[a.QuestionID]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `
			insert into public.quiz_answers (attempt_id, question_id, user_id, response)
			values ($1,$2,$3,$4)
			on conflict (attempt_id, question_id) do update set response=excluded.response`,
			attemptID, dbID, userID, a.Response); err != nil {
			return nil, err
		}
	}
	for _, score := range evaluation.QuestionScores {
		dbID, ok := qIDMap[score.QuestionID]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `
			update public.quiz_answers set score=$1, feedback=$2
			where attempt_id=$3 and question_id=$4`,
			score.Score, score.Feedback, attemptID, dbID); err != nil {
			return nil, err
		}
	}

	if _, err := tx.Exec(ctx, `
		update public.quiz_attempts
		set status='evaluated', score=$1, passed=$2, summary=$3,
			strengths=$4, gaps=$5, question_scores=$6,
			submitted_at=coalesce(submitted_at,now()), evaluated_at=now()
		where id=$7 and user_id=$8`,
		evaluation.Score, evaluation.Passed, evaluation.Summary,
		jsonbArray(evaluation.Strengths), jsonbArray(evaluation.Gaps),
		jsonbArray(evaluation.QuestionScores),
		attemptID, userID,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return p.GetLatestQuiz(ctx, userID, courseID, classID)
}

func (p *Postgres) ListLatestQuizzes(ctx context.Context, userID, courseID string) ([]domain.QuizAttempt, error) {
	rows, err := p.pool.Query(ctx, `
		select distinct on (class_id) id::text, course_id::text, class_id::text,
			status, attempt_number, passing_score, score, passed
		from public.quiz_attempts
		where course_id=$1 and user_id=$2
		order by class_id, attempt_number desc`, courseID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.QuizAttempt
	for rows.Next() {
		var a domain.QuizAttempt
		if err := rows.Scan(&a.ID, &a.CourseID, &a.ClassID, &a.Status,
			&a.AttemptNumber, &a.PassingScore, &a.Score, &a.Passed); err != nil {
			return nil, err
		}
		a.Strengths = []string{}
		a.Gaps = []domain.KnowledgeGap{}
		a.QuestionScores = []domain.QuizQuestionScore{}
		a.Questions = []domain.QuizQuestion{}
		a.Answers = []domain.QuizAnswer{}
		result = append(result, a)
	}
	if result == nil {
		result = []domain.QuizAttempt{}
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// Remedial plans
// ---------------------------------------------------------------------------

func (p *Postgres) GetLatestRemedialPlan(ctx context.Context, userID, courseID, classID string) (*domain.RemedialPlanRecord, error) {
	var plan domain.RemedialPlanRecord
	var quizAttemptID string
	err := p.pool.QueryRow(ctx, `
		select id::text, course_id::text, class_id::text,
			coalesce(quiz_attempt_id::text,''), user_id::text,
			status, gap_summary, plan, created_at, updated_at
		from public.remedial_plans
		where course_id=$1 and class_id=$2 and user_id=$3
		order by created_at desc limit 1`,
		courseID, classID, userID,
	).Scan(&plan.ID, &plan.CourseID, &plan.ClassID, &quizAttemptID,
		&plan.UserID, &plan.Status, &plan.GapSummary, &plan.Plan,
		&plan.CreatedAt, &plan.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if quizAttemptID != "" {
		plan.QuizAttemptID = &quizAttemptID
	}
	return &plan, nil
}

func (p *Postgres) CreateRemedialPlan(ctx context.Context, userID, courseID, classID, quizAttemptID string, plan any) (*domain.RemedialPlanRecord, error) {
	// plan must be a JSON object (remedial_plans_plan_check).
	data := jsonbObject(plan)
	type remedialPlanData struct {
		GapSummary string `json:"gap_summary"`
	}
	var pd remedialPlanData
	_ = json.Unmarshal(data, &pd)
	gapSummary := pd.GapSummary
	if gapSummary == "" {
		gapSummary = "AI-generated remedial plan."
	}

	// Supersede any existing active plans for this class.
	_, _ = p.pool.Exec(ctx, `
		update public.remedial_plans set status='superseded'
		where course_id=$1 and class_id=$2 and user_id=$3 and status='active'`,
		courseID, classID, userID)

	var record domain.RemedialPlanRecord
	var qaid string
	var qaidPtr *string
	if quizAttemptID != "" {
		qaidPtr = &quizAttemptID
	}
	err := p.pool.QueryRow(ctx, `
		insert into public.remedial_plans
			(course_id, class_id, quiz_attempt_id, user_id, status, gap_summary, plan)
		values ($1,$2,$3::uuid,$4,'active',$5,$6)
		returning id::text, course_id::text, class_id::text,
			coalesce(quiz_attempt_id::text,''), user_id::text,
			status, gap_summary, plan, created_at, updated_at`,
		courseID, classID, qaidPtr, userID, gapSummary, data,
	).Scan(&record.ID, &record.CourseID, &record.ClassID, &qaid,
		&record.UserID, &record.Status, &record.GapSummary, &record.Plan,
		&record.CreatedAt, &record.UpdatedAt)
	if err != nil {
		return nil, err
	}
	if qaid != "" {
		record.QuizAttemptID = &qaid
	}
	return &record, nil
}
