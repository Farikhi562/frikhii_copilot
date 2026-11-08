// Package pgrepo is the PostgreSQL implementation of intelligence.Repository.
package pgrepo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	. "github.com/frikhii/copilot/core-api/internal/intelligence"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres implements Repository on the Phase 04 tables. It opens its own small pool so
// it can be added without touching the existing store package.
//
// Every query filters by user_id; the Core API connects with a privileged role that
// bypasses RLS, so ownership is enforced here, not by the database.
type Postgres struct{ pool *pgxpool.Pool }

func NewPostgres(ctx context.Context, databaseURL string) (*Postgres, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	cfg.MaxConns, cfg.MinConns, cfg.MaxConnLifetime = 4, 0, 30*time.Minute
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
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

func jb(v any) []byte { b, _ := json.Marshal(v); return b }

func (p *Postgres) CourseInfo(ctx context.Context, userID, courseID string) (CourseInfo, error) {
	info := CourseInfo{CourseID: courseID, Prerequisites: map[string][]string{}}
	var versionID string
	err := p.pool.QueryRow(ctx, `
		select coalesce(c.approved_version_id, c.current_version_id)::text
		from public.courses c where c.id = $1::uuid and c.user_id = $2::uuid`, courseID, userID).Scan(&versionID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && versionID == "") {
		return info, ErrNotFound
	}
	if err != nil {
		return info, err
	}
	rows, err := p.pool.Query(ctx, `
		select elem->>'name' from public.course_versions v,
		       jsonb_array_elements(v.target_competencies) elem
		where v.id = $1::uuid`, versionID)
	if err != nil {
		return info, err
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return info, err
		}
		if name != "" {
			info.Competencies = append(info.Competencies, name)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return info, err
	}
	known := map[string]string{}
	for _, c := range info.Competencies {
		known[norm(c)] = c
	}
	// Relations derived from class prerequisites: a class's exercise competency depends on
	// the exercise competencies of the classes it lists as prerequisites. Plus explicit rows.
	rel, err := p.pool.Query(ctx, `
		select e.competency, pe.competency
		from public.exercises e
		join public.classes c on c.id = e.class_id
		join lateral jsonb_array_elements_text(c.prerequisite_class_ids) pid(src) on true
		join public.classes pc on pc.course_version_id = c.course_version_id and pc.source_id = pid.src
		join public.exercises pe on pe.class_id = pc.id
		where c.course_version_id = $1::uuid and lower(e.competency) <> lower(pe.competency)
		union
		select competency, prerequisite from public.competency_prerequisites where course_id = $2::uuid`, versionID, courseID)
	if err != nil {
		return info, err
	}
	defer rel.Close()
	seen := map[string]bool{}
	for rel.Next() {
		var a, b string
		if err := rel.Scan(&a, &b); err != nil {
			return info, err
		}
		ca, oka := known[norm(a)]
		cb, okb := known[norm(b)]
		if oka && okb && !seen[ca+"|"+cb] {
			seen[ca+"|"+cb] = true
			info.Prerequisites[ca] = append(info.Prerequisites[ca], cb)
		}
	}
	return info, rel.Err()
}

func (p *Postgres) InsertEvent(ctx context.Context, userID string, e Event) (Event, bool, error) {
	var id string
	err := p.pool.QueryRow(ctx, `
		insert into public.learning_events
		  (user_id, course_id, competency, event_type, score, difficulty, mistake_tags, source_ref, idempotency_key, occurred_at)
		values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
		on conflict (user_id, idempotency_key) do nothing
		returning id::text`,
		userID, e.CourseID, e.Competency, e.Type, e.Score, e.Difficulty, jb(nzs(e.MistakeTags)), e.SourceRef, e.IdempotencyKey, e.OccurredAt).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return e, false, nil
	}
	if err != nil {
		return e, false, err
	}
	e.ID = id
	return e, true, nil
}

func nzs(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func (p *Postgres) ListEvents(ctx context.Context, userID, courseID string) ([]Event, error) {
	rows, err := p.pool.Query(ctx, `
		select id::text, course_id::text, competency, event_type, score::float8, difficulty, mistake_tags, source_ref, idempotency_key, occurred_at
		from public.learning_events where user_id = $1::uuid and course_id = $2::uuid order by occurred_at, created_at`, userID, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Event
	for rows.Next() {
		var e Event
		var tags []byte
		if err := rows.Scan(&e.ID, &e.CourseID, &e.Competency, &e.Type, &e.Score, &e.Difficulty, &tags, &e.SourceRef, &e.IdempotencyKey, &e.OccurredAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(tags, &e.MistakeTags)
		out = append(out, e)
	}
	return out, rows.Err()
}

func (p *Postgres) LoadSnapshot(ctx context.Context, userID, courseID string) (Snapshot, error) {
	snap := Snapshot{CourseID: courseID, State: State{Records: map[string]Record{}}}
	rows, err := p.pool.Query(ctx, `
		select competency, status, mastery::float8, peak_mastery::float8, confidence::float8, attempts, correct_attempts,
		       common_mistakes, regression, last_demonstrated_at, last_event_at
		from public.competency_records where user_id = $1::uuid and course_id = $2::uuid`, userID, courseID)
	if err != nil {
		return snap, err
	}
	for rows.Next() {
		var r Record
		var cm []byte
		if err := rows.Scan(&r.Competency, &r.Status, &r.Mastery, &r.PeakMastery, &r.Confidence, &r.Attempts, &r.CorrectAttempts, &cm, &r.Regression, &r.LastDemonstratedAt, &r.LastEventAt); err != nil {
			rows.Close()
			return snap, err
		}
		_ = json.Unmarshal(cm, &r.CommonMistakes)
		r.AccuracyHistory = []AccuracyPoint{}
		snap.Records[r.Competency] = r
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return snap, err
	}

	hist, err := p.pool.Query(ctx, `
		select r.competency, e.occurred_at, ev.score::float8, ev.mastery_after::float8
		from public.competency_evidence ev
		join public.competency_records r on r.id = ev.record_id
		join public.learning_events e on e.id = ev.event_id
		where ev.user_id = $1::uuid and r.course_id = $2::uuid order by e.occurred_at`, userID, courseID)
	if err == nil {
		for hist.Next() {
			var c string
			var pt AccuracyPoint
			if hist.Scan(&c, &pt.At, &pt.Score, &pt.Mastery) == nil {
				r := snap.Records[c]
				r.AccuracyHistory = append(r.AccuracyHistory, pt)
				snap.Records[c] = r
			}
		}
		hist.Close()
	}

	grows, err := p.pool.Query(ctx, `
		select id::text, competency, related_objective, severity, confidence::float8, cause, prerequisites, evidence_event_ids,
		       evidence_summary, recommendation, status, opened_at, last_evidence_at, resolved_at
		from public.learner_knowledge_gaps where user_id = $1::uuid and course_id = $2::uuid order by opened_at desc`, userID, courseID)
	if err != nil {
		return snap, err
	}
	for grows.Next() {
		var g Gap
		var pre, ids []byte
		if err := grows.Scan(&g.ID, &g.Competency, &g.RelatedObjective, &g.Severity, &g.Confidence, &g.Cause, &pre, &ids, &g.EvidenceSummary, &g.Recommendation, &g.Status, &g.OpenedAt, &g.LastEvidenceAt, &g.ResolvedAt); err != nil {
			grows.Close()
			return snap, err
		}
		_ = json.Unmarshal(pre, &g.Prerequisites)
		_ = json.Unmarshal(ids, &g.EvidenceEventIDs)
		snap.Gaps = append(snap.Gaps, g)
	}
	grows.Close()

	rv, err := p.pool.Query(ctx, `select competency, due_at, interval_days, repetitions from public.review_schedules where user_id = $1::uuid and course_id = $2::uuid order by due_at`, userID, courseID)
	if err != nil {
		return snap, err
	}
	for rv.Next() {
		var r ReviewItem
		if err := rv.Scan(&r.Competency, &r.DueAt, &r.IntervalDays, &r.Repetitions); err != nil {
			rv.Close()
			return snap, err
		}
		snap.Reviews = append(snap.Reviews, r)
	}
	rv.Close()

	rc, err := p.pool.Query(ctx, `select kind, competency, title, reason, priority from public.learning_recommendations where user_id = $1::uuid and course_id = $2::uuid and status = 'active' order by priority`, userID, courseID)
	if err != nil {
		return snap, err
	}
	for rc.Next() {
		var r Recommendation
		if err := rc.Scan(&r.Kind, &r.Competency, &r.Title, &r.Reason, &r.Priority); err != nil {
			rc.Close()
			return snap, err
		}
		snap.Recommendations = append(snap.Recommendations, r)
	}
	rc.Close()

	ir, err := p.pool.Query(ctx, `
		select id::text, kind, statement, rationale, evidence_event_ids, confidence, source, status, user_note, created_at
		from public.learner_insights where user_id = $1::uuid and course_id = $2::uuid order by created_at desc`, userID, courseID)
	if err != nil {
		return snap, err
	}
	defer ir.Close()
	for ir.Next() {
		var in Insight
		var ids []byte
		if err := ir.Scan(&in.ID, &in.Kind, &in.Statement, &in.Rationale, &ids, &in.Confidence, &in.Source, &in.Status, &in.UserNote, &in.CreatedAt); err != nil {
			return snap, err
		}
		_ = json.Unmarshal(ids, &in.EvidenceEventIDs)
		snap.Insights = append(snap.Insights, in)
	}
	return snap, ir.Err()
}

func (p *Postgres) LoadAll(ctx context.Context, userID string) ([]Snapshot, error) {
	rows, err := p.pool.Query(ctx, `select distinct course_id::text from public.competency_records where user_id = $1::uuid`, userID)
	if err != nil {
		return nil, err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]Snapshot, 0, len(ids))
	for _, id := range ids {
		s, err := p.LoadSnapshot(ctx, userID, id)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}

func (p *Postgres) SaveSnapshot(ctx context.Context, userID string, snap Snapshot, evidence []EvidenceRow) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var owned bool
	if err := tx.QueryRow(ctx, `select exists(select 1 from public.courses where id = $1::uuid and user_id = $2::uuid)`, snap.CourseID, userID).Scan(&owned); err != nil {
		return err
	}
	if !owned {
		return ErrNotFound
	}
	ids := map[string]string{}
	for name, r := range snap.Records {
		var id string
		err := tx.QueryRow(ctx, `
			insert into public.competency_records
			  (user_id, course_id, competency, status, mastery, peak_mastery, confidence, attempts, correct_attempts, common_mistakes, regression, last_demonstrated_at, last_event_at)
			values ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)
			on conflict (user_id, course_id, competency) do update set
			  status=excluded.status, mastery=excluded.mastery, peak_mastery=excluded.peak_mastery, confidence=excluded.confidence,
			  attempts=excluded.attempts, correct_attempts=excluded.correct_attempts, common_mistakes=excluded.common_mistakes,
			  regression=excluded.regression, last_demonstrated_at=excluded.last_demonstrated_at, last_event_at=excluded.last_event_at
			returning id::text`,
			userID, snap.CourseID, name, r.Status, r.Mastery, r.PeakMastery, r.Confidence, r.Attempts, r.CorrectAttempts, jb(r.CommonMistakes), r.Regression, r.LastDemonstratedAt, r.LastEventAt).Scan(&id)
		if err != nil {
			return err
		}
		ids[name] = id
	}
	for _, ev := range evidence {
		rid, ok := ids[ev.Competency]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `
			insert into public.competency_evidence (user_id, record_id, event_id, mastery_before, mastery_after, status_after)
			values ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6) on conflict (record_id, event_id) do nothing`,
			userID, rid, ev.EventID, ev.MasteryBefore, ev.MasteryAfter, ev.StatusAfter); err != nil {
			return err
		}
	}
	for _, g := range snap.Gaps {
		if g.ID != "" {
			if g.Status == "resolved" && g.ResolvedAt == nil {
				continue
			}
			if _, err := tx.Exec(ctx, `
				update public.learner_knowledge_gaps set severity=$3, confidence=$4, cause=$5, prerequisites=$6::jsonb,
				  evidence_event_ids=$7::jsonb, evidence_summary=$8, recommendation=$9, status=$10, last_evidence_at=$11, resolved_at=$12
				where id=$1::uuid and user_id=$2::uuid`,
				g.ID, userID, g.Severity, g.Confidence, g.Cause, jb(nzs(g.Prerequisites)), jb(nzs(g.EvidenceEventIDs)), g.EvidenceSummary, g.Recommendation, g.Status, g.LastEvidenceAt, g.ResolvedAt); err != nil {
				return err
			}
			continue
		}
		if _, err := tx.Exec(ctx, `
			insert into public.learner_knowledge_gaps
			  (user_id, course_id, competency, related_objective, severity, confidence, cause, prerequisites, evidence_event_ids, evidence_summary, recommendation, status, opened_at, last_evidence_at)
			values ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14)`,
			userID, snap.CourseID, g.Competency, g.RelatedObjective, g.Severity, g.Confidence, g.Cause, jb(nzs(g.Prerequisites)), jb(nzs(g.EvidenceEventIDs)), g.EvidenceSummary, g.Recommendation, g.Status, g.OpenedAt, g.LastEvidenceAt); err != nil {
			return err
		}
	}
	for _, rv := range snap.Reviews {
		if _, err := tx.Exec(ctx, `
			insert into public.review_schedules (user_id, course_id, competency, due_at, interval_days, repetitions)
			values ($1::uuid,$2::uuid,$3,$4,$5,$6)
			on conflict (user_id, course_id, competency) do update set due_at=excluded.due_at, interval_days=excluded.interval_days, repetitions=excluded.repetitions`,
			userID, snap.CourseID, rv.Competency, rv.DueAt, rv.IntervalDays, rv.Repetitions); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `delete from public.learning_recommendations where user_id=$1::uuid and course_id=$2::uuid and status='active'`, userID, snap.CourseID); err != nil {
		return err
	}
	for _, r := range snap.Recommendations {
		if _, err := tx.Exec(ctx, `
			insert into public.learning_recommendations (user_id, course_id, kind, competency, title, reason, priority)
			values ($1::uuid,$2::uuid,$3,$4,$5,$6,$7)`, userID, snap.CourseID, r.Kind, r.Competency, r.Title, r.Reason, r.Priority); err != nil {
			return err
		}
	}
	if _, err := tx.Exec(ctx, `delete from public.learner_insights where user_id=$1::uuid and course_id=$2::uuid and source='rules' and status='active'`, userID, snap.CourseID); err != nil {
		return err
	}
	for _, in := range snap.RuleInsights {
		if _, err := tx.Exec(ctx, `
			insert into public.learner_insights (user_id, course_id, kind, statement, rationale, evidence_event_ids, confidence, source)
			values ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,'rules')`,
			userID, snap.CourseID, in.Kind, in.Statement, in.Rationale, jb(in.EvidenceEventIDs), in.Confidence); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (p *Postgres) GetPreferences(ctx context.Context, userID string) (Preferences, error) {
	pr := DefaultPreferences()
	err := p.pool.QueryRow(ctx, `
		select explanation_style, example_style, pace, preferred_language, daily_study_minutes, short_term_target, long_term_target
		from public.learner_preferences where user_id = $1::uuid`, userID).
		Scan(&pr.ExplanationStyle, &pr.ExampleStyle, &pr.Pace, &pr.PreferredLanguage, &pr.DailyStudyMinutes, &pr.ShortTermTarget, &pr.LongTermTarget)
	if errors.Is(err, pgx.ErrNoRows) {
		return DefaultPreferences(), nil
	}
	return pr, err
}

func (p *Postgres) SavePreferences(ctx context.Context, userID string, pr Preferences) error {
	_, err := p.pool.Exec(ctx, `
		insert into public.learner_preferences (user_id, explanation_style, example_style, pace, preferred_language, daily_study_minutes, short_term_target, long_term_target)
		values ($1::uuid,$2,$3,$4,$5,$6,$7,$8)
		on conflict (user_id) do update set explanation_style=excluded.explanation_style, example_style=excluded.example_style,
		  pace=excluded.pace, preferred_language=excluded.preferred_language, daily_study_minutes=excluded.daily_study_minutes,
		  short_term_target=excluded.short_term_target, long_term_target=excluded.long_term_target`,
		userID, pr.ExplanationStyle, pr.ExampleStyle, pr.Pace, pr.PreferredLanguage, pr.DailyStudyMinutes, pr.ShortTermTarget, pr.LongTermTarget)
	return err
}

func (p *Postgres) SetInsightStatus(ctx context.Context, userID, insightID, status, note string) error {
	tag, err := p.pool.Exec(ctx, `update public.learner_insights set status=$3, user_note=$4 where id=$1::uuid and user_id=$2::uuid`, insightID, userID, status, note)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (p *Postgres) AddInsights(ctx context.Context, userID, courseID string, ins []Insight) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	for _, in := range ins {
		if _, err := tx.Exec(ctx, `
			insert into public.learner_insights (user_id, course_id, kind, statement, rationale, evidence_event_ids, confidence, source)
			values ($1::uuid,$2::uuid,$3,$4,$5,$6::jsonb,$7,'ai')`,
			userID, courseID, in.Kind, in.Statement, in.Rationale, jb(in.EvidenceEventIDs), in.Confidence); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// Reset removes all learner intelligence for the user. Cascades clear evidence rows.
func (p *Postgres) Reset(ctx context.Context, userID string) error {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	for _, t := range []string{"review_schedules", "learning_recommendations", "learner_insights", "learner_knowledge_gaps", "competency_records", "learning_events", "learner_preferences"} {
		if _, err := tx.Exec(ctx, "delete from public."+t+" where user_id = $1::uuid", userID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func norm(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

var _ Repository = (*Postgres)(nil)
