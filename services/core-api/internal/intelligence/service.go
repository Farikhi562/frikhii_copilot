package intelligence

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// Snapshot is the persisted state for one user+course.
type Snapshot struct {
	CourseID string
	State
	Insights []Insight // rule + AI + user-corrected, newest first
}

type Repository interface {
	// CourseInfo returns ErrNotFound when the course does not belong to the user.
	CourseInfo(ctx context.Context, userID, courseID string) (CourseInfo, error)
	// InsertEvent stores evidence; inserted=false means a duplicate idempotency key.
	InsertEvent(ctx context.Context, userID string, e Event) (stored Event, inserted bool, err error)
	ListEvents(ctx context.Context, userID, courseID string) ([]Event, error)
	LoadSnapshot(ctx context.Context, userID, courseID string) (Snapshot, error)
	LoadAll(ctx context.Context, userID string) ([]Snapshot, error)
	// SaveSnapshot atomically replaces derived state and appends evidence rows.
	SaveSnapshot(ctx context.Context, userID string, snap Snapshot, evidence []EvidenceRow) error
	GetPreferences(ctx context.Context, userID string) (Preferences, error)
	SavePreferences(ctx context.Context, userID string, p Preferences) error
	SetInsightStatus(ctx context.Context, userID, insightID, status, note string) error
	AddInsights(ctx context.Context, userID, courseID string, insights []Insight) error
	// Reset deletes all learner intelligence for the user (events included).
	Reset(ctx context.Context, userID string) error
}

type Service struct {
	repo Repository
	now  func() time.Time
}

func NewService(repo Repository) *Service { return &Service{repo: repo, now: time.Now} }

type EventInput struct {
	CourseID       string    `json:"course_id"`
	Competency     string    `json:"competency"`
	Type           string    `json:"event_type"`
	Score          float64   `json:"score"`
	Difficulty     string    `json:"difficulty"`
	MistakeTags    []string  `json:"mistake_tags"`
	SourceRef      string    `json:"source_ref"`
	IdempotencyKey string    `json:"idempotency_key"`
	OccurredAt     time.Time `json:"occurred_at"`
}

type RecordResult struct {
	Duplicate bool    `json:"duplicate"`
	Record    *Record `json:"record,omitempty"`
	Gap       *Gap    `json:"gap,omitempty"`
}

func invalid(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...))
}

func (in *EventInput) validate() error {
	in.Competency = strings.TrimSpace(in.Competency)
	if _, ok := EventTypes[in.Type]; !ok {
		return invalid("unknown event_type")
	}
	if in.CourseID == "" {
		return invalid("course_id is required")
	}
	if n := utf8.RuneCountInString(in.Competency); n < 2 || n > 160 {
		return invalid("competency must be 2-160 characters")
	}
	if in.Score != in.Score || in.Score < 0 || in.Score > 1 {
		return invalid("score must be between 0 and 1")
	}
	if in.Difficulty == "" {
		in.Difficulty = "medium"
	}
	if _, ok := difficultyWeight[in.Difficulty]; !ok {
		return invalid("difficulty must be easy, medium or hard")
	}
	if n := len(in.IdempotencyKey); n < 8 || n > 120 {
		return invalid("idempotency_key must be 8-120 characters")
	}
	if len(in.SourceRef) > 200 {
		return invalid("source_ref is too long")
	}
	if len(in.MistakeTags) > 10 {
		return invalid("at most 10 mistake_tags")
	}
	for i, t := range in.MistakeTags {
		t = strings.TrimSpace(t)
		if t == "" || utf8.RuneCountInString(t) > 80 {
			return invalid("mistake_tags must be 1-80 characters")
		}
		in.MistakeTags[i] = t
	}
	return nil
}

// RecordEvent validates one event, stores it idempotently and recomputes the derived
// state for the course. Zero-weight events (explanation feedback) are stored without
// triggering a recompute, so insignificant interactions do not churn the profile.
func (s *Service) RecordEvent(ctx context.Context, userID string, in EventInput) (*RecordResult, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	info, err := s.repo.CourseInfo(ctx, userID, in.CourseID)
	if err != nil {
		return nil, err
	}
	canon := ""
	for _, c := range info.Competencies {
		if norm(c) == norm(in.Competency) {
			canon = c
		}
	}
	if canon == "" {
		return nil, ErrUnknownCmp
	}
	at := in.OccurredAt
	if at.IsZero() {
		at = s.now()
	}
	if at.After(s.now().Add(5 * time.Minute)) {
		return nil, invalid("occurred_at is in the future")
	}
	stored, inserted, err := s.repo.InsertEvent(ctx, userID, Event{
		CourseID: in.CourseID, Competency: canon, Type: in.Type, Score: in.Score, Difficulty: in.Difficulty,
		MistakeTags: in.MistakeTags, SourceRef: in.SourceRef, IdempotencyKey: in.IdempotencyKey, OccurredAt: at.UTC(),
	})
	if err != nil {
		return nil, err
	}
	if !inserted {
		return &RecordResult{Duplicate: true}, nil
	}
	if EventTypes[in.Type] == 0 {
		return &RecordResult{}, nil
	}
	snap, err := s.Recompute(ctx, userID, info, &stored)
	if err != nil {
		return nil, err
	}
	res := &RecordResult{}
	if r, ok := snap.Records[canon]; ok {
		res.Record = &r
	}
	for i := range snap.Gaps {
		if norm(snap.Gaps[i].Competency) == norm(canon) && snap.Gaps[i].Status != "resolved" {
			res.Gap = &snap.Gaps[i]
		}
	}
	return res, nil
}

// Recompute rebuilds derived state from the course's events (the source of truth).
func (s *Service) Recompute(ctx context.Context, userID string, info CourseInfo, trigger *Event) (Snapshot, error) {
	events, err := s.repo.ListEvents(ctx, userID, info.CourseID)
	if err != nil {
		return Snapshot{}, err
	}
	prev, err := s.repo.LoadSnapshot(ctx, userID, info.CourseID)
	if err != nil {
		return Snapshot{}, err
	}
	byComp := map[string][]Event{}
	for _, e := range events {
		byComp[e.Competency] = append(byComp[e.Competency], e)
	}
	now := s.now()
	records := map[string]Record{}
	for c, ev := range byComp {
		records[c] = ComputeRecord(c, ev)
	}

	var evidence []EvidenceRow
	if trigger != nil {
		var without []Event
		for _, e := range byComp[trigger.Competency] {
			if e.ID != trigger.ID {
				without = append(without, e)
			}
		}
		before := ComputeRecord(trigger.Competency, without).Mastery
		after := records[trigger.Competency]
		evidence = append(evidence, EvidenceRow{EventID: trigger.ID, Competency: trigger.Competency, MasteryBefore: before, MasteryAfter: after.Mastery, StatusAfter: after.Status})
	}

	// Gaps: keep resolved history, reconcile open ones, open new ones.
	var gaps []Gap
	openByComp := map[string]Gap{}
	for _, g := range prev.Gaps {
		if g.Status == "resolved" {
			gaps = append(gaps, g)
		} else {
			openByComp[norm(g.Competency)] = g
		}
	}
	for _, c := range sortedKeys(records) {
		rec := records[c]
		detected := DetectGap(rec, byComp[c], info, records)
		existing, hasOpen := openByComp[norm(c)]
		switch {
		case hasOpen:
			upd := ReconcileGap(existing, rec, byComp[c], now)
			if upd.Status == "open" && detected != nil {
				upd.Severity, upd.Cause, upd.Prerequisites, upd.Unverified = detected.Severity, detected.Cause, detected.Prerequisites, detected.Unverified
				upd.EvidenceEventIDs, upd.EvidenceSummary, upd.Recommendation = detected.EvidenceEventIDs, detected.EvidenceSummary, detected.Recommendation
			}
			gaps = append(gaps, upd)
		case detected != nil:
			gaps = append(gaps, *detected)
		}
	}

	prevReview := map[string]ReviewItem{}
	for _, r := range prev.Reviews {
		prevReview[norm(r.Competency)] = r
	}
	var reviews []ReviewItem
	for _, c := range sortedKeys(records) {
		p, ok := prevReview[norm(c)]
		var pp *ReviewItem
		if ok {
			pp = &p
		}
		// Only advance the ladder when this competency received the new event.
		if trigger != nil && trigger.Competency != c && pp != nil {
			reviews = append(reviews, *pp)
			continue
		}
		if next := NextReview(pp, records[c], now); next != nil {
			reviews = append(reviews, *next)
		}
	}

	snap := Snapshot{CourseID: info.CourseID, State: State{
		Records: records, Gaps: gaps, Reviews: reviews,
		Recommendations: Recommend(info, records, gaps, reviews, now),
		RuleInsights:    RuleInsights(records, byComp, now),
	}}
	if err := s.repo.SaveSnapshot(ctx, userID, snap, evidence); err != nil {
		return Snapshot{}, err
	}
	return snap, nil
}

// Overview returns every course snapshot the user has evidence for.
func (s *Service) Overview(ctx context.Context, userID string) ([]Snapshot, Preferences, error) {
	snaps, err := s.repo.LoadAll(ctx, userID)
	if err != nil {
		return nil, Preferences{}, err
	}
	prefs, err := s.repo.GetPreferences(ctx, userID)
	return snaps, prefs, err
}

func (s *Service) Preferences(ctx context.Context, userID string) (Preferences, error) {
	return s.repo.GetPreferences(ctx, userID)
}

var (
	styles   = map[string]bool{"simple": true, "balanced": true, "technical": true}
	examples = map[string]bool{"practical": true, "visual": true, "analogy": true, "mixed": true}
	paces    = map[string]bool{"slow": true, "steady": true, "fast": true}
	langs    = map[string]bool{"id-ID": true, "en-US": true}
)

func (s *Service) SavePreferences(ctx context.Context, userID string, p Preferences) (Preferences, error) {
	p.ShortTermTarget, p.LongTermTarget = strings.TrimSpace(p.ShortTermTarget), strings.TrimSpace(p.LongTermTarget)
	switch {
	case !styles[p.ExplanationStyle]:
		return p, invalid("explanation_style must be simple, balanced or technical")
	case !examples[p.ExampleStyle]:
		return p, invalid("example_style must be practical, visual, analogy or mixed")
	case !paces[p.Pace]:
		return p, invalid("pace must be slow, steady or fast")
	case !langs[p.PreferredLanguage]:
		return p, invalid("preferred_language must be id-ID or en-US")
	case p.DailyStudyMinutes != nil && (*p.DailyStudyMinutes < 5 || *p.DailyStudyMinutes > 720):
		return p, invalid("daily_study_minutes must be between 5 and 720")
	case utf8.RuneCountInString(p.ShortTermTarget) > 500 || utf8.RuneCountInString(p.LongTermTarget) > 500:
		return p, invalid("targets must be at most 500 characters")
	}
	return p, s.repo.SavePreferences(ctx, userID, p)
}

// CorrectInsight lets the learner mark an insight as wrong (with a note) or dismiss it.
func (s *Service) CorrectInsight(ctx context.Context, userID, insightID, status, note string) error {
	if status != "corrected" && status != "dismissed" && status != "active" {
		return invalid("status must be active, corrected or dismissed")
	}
	if utf8.RuneCountInString(note) > 500 {
		return invalid("note must be at most 500 characters")
	}
	return s.repo.SetInsightStatus(ctx, userID, insightID, status, strings.TrimSpace(note))
}

func (s *Service) Reset(ctx context.Context, userID string) error { return s.repo.Reset(ctx, userID) }

// TutorGuidance builds personalisation context for the AI tutor from stored evidence.
// With no history it returns a low-certainty "standard" guidance, never invented facts.
func (s *Service) TutorGuidance(ctx context.Context, userID, courseID, competency string) (TutorGuidance, error) {
	prefs, err := s.repo.GetPreferences(ctx, userID)
	if err != nil {
		return TutorGuidance{}, err
	}
	if _, err := s.repo.CourseInfo(ctx, userID, courseID); err != nil {
		return TutorGuidance{}, err
	}
	snap, err := s.repo.LoadSnapshot(ctx, userID, courseID)
	if err != nil {
		return TutorGuidance{}, err
	}
	events, err := s.repo.ListEvents(ctx, userID, courseID)
	if err != nil {
		return TutorGuidance{}, err
	}
	byComp := map[string][]Event{}
	for _, e := range events {
		byComp[e.Competency] = append(byComp[e.Competency], e)
	}
	return BuildGuidance(competency, snap.Records, snap.Gaps, byComp, prefs), nil
}

// AIInsight is the shape the AI Engine returns. It is untrusted until validated.
type AIInsight struct {
	Kind             string   `json:"kind"`
	Statement        string   `json:"statement"`
	Rationale        string   `json:"rationale"`
	EvidenceEventIDs []string `json:"evidence_event_ids"`
	Confidence       string   `json:"confidence"`
}

var forbidden = []string{"iq", "intelligen", "lazy", "stupid", "dumb", "unmotivated", "disorder", "adhd", "dyslex", "autis", "depress", "anxiety", "personality", "gifted", "talentless", "hopeless", "bad at", "incapable"}

// ValidateAIInsights keeps only insights that cite real event ids for this user, stay in
// the allowed vocabulary, make no psychological or intelligence claims, and are bounded
// in length. Everything else is dropped.
func ValidateAIInsights(raw []AIInsight, validEvents map[string]bool, now time.Time) []Insight {
	kinds := map[string]bool{"strength": true, "pattern": true, "misconception": true, "strategy": true}
	var out []Insight
	for _, r := range raw {
		st, ra := strings.TrimSpace(r.Statement), strings.TrimSpace(r.Rationale)
		if !kinds[r.Kind] || (r.Confidence != "low" && r.Confidence != "medium" && r.Confidence != "high") {
			continue
		}
		if n := utf8.RuneCountInString(st); n < 5 || n > 500 {
			continue
		}
		if n := utf8.RuneCountInString(ra); n < 5 || n > 800 {
			continue
		}
		low := strings.ToLower(st + " " + ra)
		bad := false
		for _, w := range forbidden {
			if strings.Contains(low, w) {
				bad = true
				break
			}
		}
		if bad || len(r.EvidenceEventIDs) == 0 {
			continue
		}
		ok := true
		for _, id := range r.EvidenceEventIDs {
			if !validEvents[id] {
				ok = false
			}
		}
		if !ok {
			continue
		}
		out = append(out, Insight{Kind: r.Kind, Statement: st, Rationale: ra, EvidenceEventIDs: r.EvidenceEventIDs, Confidence: r.Confidence, Source: "ai", Status: "active", CreatedAt: now})
		if len(out) == 5 {
			break
		}
	}
	return out
}

// StoreAIInsights validates and stores AI insights for a course.
func (s *Service) StoreAIInsights(ctx context.Context, userID, courseID string, raw []AIInsight) (int, error) {
	if _, err := s.repo.CourseInfo(ctx, userID, courseID); err != nil {
		return 0, err
	}
	events, err := s.repo.ListEvents(ctx, userID, courseID)
	if err != nil {
		return 0, err
	}
	valid := map[string]bool{}
	for _, e := range events {
		valid[e.ID] = true
	}
	ins := ValidateAIInsights(raw, valid, s.now())
	if len(ins) == 0 {
		return 0, nil
	}
	return len(ins), s.repo.AddInsights(ctx, userID, courseID, ins)
}

// EvidenceDigest is the compact, evidence-only payload sent to the AI Engine.
type EvidenceDigest struct {
	Competency string  `json:"competency"`
	Status     string  `json:"status"`
	Attempts   int     `json:"attempts"`
	Mastery    float64 `json:"estimated_mastery"`
	Mistakes   []string
	Events     []DigestEvent `json:"events"`
}

type DigestEvent struct {
	ID    string  `json:"id"`
	Type  string  `json:"event_type"`
	Score float64 `json:"score"`
	At    string  `json:"at"`
}

func (s *Service) Digest(ctx context.Context, userID, courseID string) ([]EvidenceDigest, error) {
	if _, err := s.repo.CourseInfo(ctx, userID, courseID); err != nil {
		return nil, err
	}
	events, err := s.repo.ListEvents(ctx, userID, courseID)
	if err != nil {
		return nil, err
	}
	byComp := map[string][]Event{}
	for _, e := range events {
		byComp[e.Competency] = append(byComp[e.Competency], e)
	}
	var out []EvidenceDigest
	for c, ev := range byComp {
		r := ComputeRecord(c, ev)
		d := EvidenceDigest{Competency: c, Status: r.Status, Attempts: r.Attempts, Mastery: r.Mastery}
		for _, m := range r.CommonMistakes {
			d.Mistakes = append(d.Mistakes, m.Tag)
		}
		sc := scored(ev)
		if len(sc) > 10 {
			sc = sc[len(sc)-10:]
		}
		for _, e := range sc {
			d.Events = append(d.Events, DigestEvent{ID: e.ID, Type: e.Type, Score: e.Score, At: e.OccurredAt.Format(time.RFC3339)})
		}
		out = append(out, d)
	}
	return out, nil
}
