package intelligence

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"
)

const (
	ariaID = "user-aria"
	budiID = "user-budi"
	course = "course-1"
)

var t0 = time.Date(2026, 10, 1, 9, 0, 0, 0, time.UTC)

func info() CourseInfo {
	return CourseInfo{
		CourseID:     course,
		Competencies: []string{"Derivatives", "Gradient descent", "Neural networks"},
		Prerequisites: map[string][]string{
			"Gradient descent": {"Derivatives"},
			"Neural networks":  {"Gradient descent"},
		},
	}
}

type harness struct {
	svc *Service
	mem *Memory
	now time.Time
	n   int
}

func newHarness() *harness {
	mem := NewMemory()
	mem.AddCourse(ariaID, info())
	mem.AddCourse(budiID, CourseInfo{CourseID: "course-b", Competencies: info().Competencies, Prerequisites: info().Prerequisites})
	h := &harness{mem: mem, now: t0}
	h.svc = NewService(mem)
	h.svc.now = func() time.Time { return h.now }
	return h
}

func (h *harness) rec(user, courseID, comp, typ string, score float64, tags ...string) (*RecordResult, error) {
	h.n++
	h.now = h.now.Add(24 * time.Hour)
	return h.svc.RecordEvent(context.Background(), user, EventInput{
		CourseID: courseID, Competency: comp, Type: typ, Score: score, MistakeTags: tags,
		IdempotencyKey: fmt.Sprintf("key-%s-%d", user, h.n), OccurredAt: h.now,
	})
}

func (h *harness) snap(user, courseID string) Snapshot {
	s, _ := h.mem.LoadSnapshot(context.Background(), user, courseID)
	return s
}

// Test A: repeated weakness -> gap with evidence, prerequisite review, tutor adapts.
func TestA_RepeatedWeaknessDetectsGapAndPrerequisiteReview(t *testing.T) {
	h := newHarness()
	for _, s := range []float64{0.2, 0.3, 0.1} {
		h.rec(ariaID, course, "Derivatives", "exercise_submitted", s, "chain rule")
	}
	for _, s := range []float64{0.3, 0.2, 0.25} {
		h.rec(ariaID, course, "Gradient descent", "exercise_submitted", s)
	}
	snap := h.snap(ariaID, course)
	var gap *Gap
	for i := range snap.Gaps {
		if snap.Gaps[i].Competency == "Gradient descent" {
			gap = &snap.Gaps[i]
		}
	}
	if gap == nil {
		t.Fatal("expected a gap on Gradient descent")
	}
	if gap.Cause != "prerequisite" || len(gap.Prerequisites) != 1 || gap.Prerequisites[0] != "Derivatives" {
		t.Fatalf("cause=%s prereqs=%v", gap.Cause, gap.Prerequisites)
	}
	if len(gap.EvidenceEventIDs) == 0 || gap.EvidenceSummary == "" {
		t.Fatal("gap must carry evidence")
	}
	found := false
	for _, r := range snap.Recommendations {
		if r.Kind == "review_prerequisite" && r.Competency == "Derivatives" && strings.Contains(r.Reason, "Gradient descent") {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected prerequisite review recommendation, got %+v", snap.Recommendations)
	}
	g, err := h.svc.TutorGuidance(context.Background(), ariaID, course, "Gradient descent")
	if err != nil {
		t.Fatal(err)
	}
	if g.Approach != "prerequisite_first" || len(g.ReviewFirst) != 1 || g.ReviewFirst[0] != "Derivatives" {
		t.Fatalf("guidance=%+v", g)
	}
}

func TestSingleWrongAnswerIsNotAGap(t *testing.T) {
	h := newHarness()
	h.rec(ariaID, course, "Derivatives", "exercise_submitted", 0.0)
	if gaps := h.snap(ariaID, course).Gaps; len(gaps) != 0 {
		t.Fatalf("one failure must not create a gap: %+v", gaps)
	}
}

func TestSingleCorrectAnswerIsNotMastery(t *testing.T) {
	h := newHarness()
	r, err := h.rec(ariaID, course, "Derivatives", "assessment_result", 1.0)
	if err != nil {
		t.Fatal(err)
	}
	if r.Record.Status != StatusLearning {
		t.Fatalf("status=%s", r.Record.Status)
	}
}

// Test B: remedial success -> new evidence, mastery recalculated, gap improves then resolves.
func TestB_ImprovementResolvesGap(t *testing.T) {
	h := newHarness()
	for _, s := range []float64{0.2, 0.3, 0.1, 0.2} {
		h.rec(ariaID, course, "Derivatives", "exercise_submitted", s)
	}
	before := h.snap(ariaID, course).Records["Derivatives"].Mastery
	if len(openGaps(h.snap(ariaID, course))) != 1 {
		t.Fatal("expected an open gap first")
	}
	h.rec(ariaID, course, "Derivatives", "remediation_completed", 0.9)
	h.rec(ariaID, course, "Derivatives", "remediation_completed", 0.95)
	h.rec(ariaID, course, "Derivatives", "remediation_completed", 0.95)
	h.rec(ariaID, course, "Derivatives", "exercise_submitted", 0.9)
	h.rec(ariaID, course, "Derivatives", "assessment_result", 0.95)
	snap := h.snap(ariaID, course)
	if snap.Records["Derivatives"].Mastery <= before {
		t.Fatal("mastery should rise")
	}
	if len(openGaps(snap)) != 0 {
		t.Fatalf("gap should be resolved: %+v", snap.Gaps)
	}
	resolved := 0
	for _, g := range snap.Gaps {
		if g.Status == "resolved" && g.ResolvedAt != nil {
			resolved++
		}
	}
	if resolved != 1 {
		t.Fatal("resolved gap must stay in history")
	}
	if len(h.mem.Evidence(ariaID)) != 9 {
		t.Fatalf("audit rows=%d", len(h.mem.Evidence(ariaID)))
	}
}

func openGaps(s Snapshot) []Gap {
	var o []Gap
	for _, g := range s.Gaps {
		if g.Status != "resolved" {
			o = append(o, g)
		}
	}
	return o
}

// Test C: strong performance -> mastery, challenge recommendation, beginner explanations reduced.
func TestC_StrongPerformance(t *testing.T) {
	h := newHarness()
	for i := 0; i < 5; i++ {
		h.rec(ariaID, course, "Derivatives", "assessment_result", 0.95)
	}
	snap := h.snap(ariaID, course)
	if snap.Records["Derivatives"].Status != StatusMastered {
		t.Fatalf("status=%s", snap.Records["Derivatives"].Status)
	}
	kinds := map[string]bool{}
	for _, r := range snap.Recommendations {
		kinds[r.Kind] = true
	}
	if !kinds["challenge"] || !kinds["advance"] {
		t.Fatalf("recs=%+v", snap.Recommendations)
	}
	g, _ := h.svc.TutorGuidance(context.Background(), ariaID, course, "Derivatives")
	if g.Approach != "challenge" || len(g.Skip) != 1 {
		t.Fatalf("guidance=%+v", g)
	}
}

// Test D: previously mastered concept fails a retention check -> regression, review, history kept.
func TestD_RetentionRegression(t *testing.T) {
	h := newHarness()
	for i := 0; i < 5; i++ {
		h.rec(ariaID, course, "Derivatives", "assessment_result", 0.95)
	}
	h.rec(ariaID, course, "Derivatives", "retention_check", 0.1)
	snap := h.snap(ariaID, course)
	rec := snap.Records["Derivatives"]
	if !rec.Regression || rec.PeakMastery < 0.85 {
		t.Fatalf("regression=%v peak=%v", rec.Regression, rec.PeakMastery)
	}
	if len(rec.AccuracyHistory) != 6 {
		t.Fatalf("history must remain: %d", len(rec.AccuracyHistory))
	}
	var gap *Gap
	for i := range snap.Gaps {
		gap = &snap.Gaps[i]
	}
	if gap == nil || gap.Cause != "retention" {
		t.Fatalf("gap=%+v", gap)
	}
	hasReview := false
	for _, r := range snap.Recommendations {
		if r.Kind == "review_retention" && r.Competency == "Derivatives" {
			hasReview = true
		}
	}
	if !hasReview {
		t.Fatal("expected a targeted review recommendation")
	}
	g, _ := h.svc.TutorGuidance(context.Background(), ariaID, course, "Derivatives")
	if g.Approach != "retrieval_review" {
		t.Fatalf("approach=%s", g.Approach)
	}
	if len(snap.Reviews) == 0 || snap.Reviews[0].IntervalDays != 1 {
		t.Fatalf("review should reset to 1 day: %+v", snap.Reviews)
	}
}

// Test E: same lesson, different histories -> different guidance, isolated data.
func TestE_PersonalisationAndIsolation(t *testing.T) {
	h := newHarness()
	for _, s := range []float64{0.2, 0.1, 0.2} {
		h.rec(ariaID, course, "Derivatives", "exercise_submitted", s)
	}
	for i := 0; i < 5; i++ {
		h.rec(budiID, "course-b", "Derivatives", "assessment_result", 0.95)
	}
	ga, _ := h.svc.TutorGuidance(context.Background(), ariaID, course, "Derivatives")
	gb, _ := h.svc.TutorGuidance(context.Background(), budiID, "course-b", "Derivatives")
	if ga.Approach == gb.Approach {
		t.Fatalf("both got %s", ga.Approach)
	}
	if len(h.snap(ariaID, "course-b").Records) != 0 {
		t.Fatal("Aria must not see Budi's data")
	}
	if _, err := h.svc.TutorGuidance(context.Background(), ariaID, "course-b", "Derivatives"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("cross-user course access must be not found, got %v", err)
	}
	snaps, _, _ := h.svc.Overview(context.Background(), ariaID)
	for _, s := range snaps {
		if s.CourseID == "course-b" {
			t.Fatal("overview leaked another user's course")
		}
	}
}

func TestTheoryPracticeSplitUsesWorkedExamples(t *testing.T) {
	h := newHarness()
	for _, s := range []float64{0.9, 0.9} {
		h.rec(ariaID, course, "Derivatives", "assessment_result", s)
	}
	for _, s := range []float64{0.4, 0.5} {
		h.rec(ariaID, course, "Derivatives", "exercise_submitted", s)
	}
	g, _ := h.svc.TutorGuidance(context.Background(), ariaID, course, "Derivatives")
	if g.Approach != "worked_examples" {
		t.Fatalf("approach=%s", g.Approach)
	}
}

func TestMissingHistoryIsLowCertaintyAndNotInvented(t *testing.T) {
	h := newHarness()
	g, err := h.svc.TutorGuidance(context.Background(), ariaID, course, "Derivatives")
	if err != nil {
		t.Fatal(err)
	}
	if g.Approach != "standard" || g.Certainty != "low" || len(g.Strengths) != 0 {
		t.Fatalf("guidance=%+v", g)
	}
	snaps, _, _ := h.svc.Overview(context.Background(), ariaID)
	if len(snaps) != 0 {
		t.Fatal("no evidence must mean no snapshots")
	}
}

func TestDuplicateEventsAreNotDoubleCounted(t *testing.T) {
	h := newHarness()
	in := EventInput{CourseID: course, Competency: "Derivatives", Type: "assessment_result", Score: 0.9, IdempotencyKey: "same-key-1", OccurredAt: t0}
	if r, _ := h.svc.RecordEvent(context.Background(), ariaID, in); r.Duplicate {
		t.Fatal("first must insert")
	}
	r, err := h.svc.RecordEvent(context.Background(), ariaID, in)
	if err != nil || !r.Duplicate {
		t.Fatalf("second must be a duplicate: %v %+v", err, r)
	}
	if h.snap(ariaID, course).Records["Derivatives"].Attempts != 1 {
		t.Fatal("attempts must stay 1")
	}
}

func TestValidation(t *testing.T) {
	h := newHarness()
	bad := []EventInput{
		{CourseID: course, Competency: "Derivatives", Type: "nope", Score: 0.5, IdempotencyKey: "abcdefgh"},
		{CourseID: course, Competency: "Derivatives", Type: "assessment_result", Score: 1.5, IdempotencyKey: "abcdefgh"},
		{CourseID: course, Competency: "Derivatives", Type: "assessment_result", Score: -0.1, IdempotencyKey: "abcdefgh"},
		{CourseID: course, Competency: "Derivatives", Type: "assessment_result", Score: 0.5, IdempotencyKey: "x"},
		{CourseID: course, Competency: "Derivatives", Type: "assessment_result", Score: 0.5, IdempotencyKey: "abcdefgh", OccurredAt: t0.AddDate(1, 0, 0)},
	}
	h.now = t0
	for i, in := range bad {
		if _, err := h.svc.RecordEvent(context.Background(), ariaID, in); !errors.Is(err, ErrInvalid) {
			t.Fatalf("case %d: expected invalid, got %v", i, err)
		}
	}
	_, err := h.svc.RecordEvent(context.Background(), ariaID, EventInput{CourseID: course, Competency: "Cooking", Type: "assessment_result", Score: 0.5, IdempotencyKey: "abcdefgh"})
	if !errors.Is(err, ErrUnknownCmp) {
		t.Fatalf("unknown competency: %v", err)
	}
	_, err = h.svc.RecordEvent(context.Background(), budiID, EventInput{CourseID: course, Competency: "Derivatives", Type: "assessment_result", Score: 0.5, IdempotencyKey: "abcdefgh"})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("not the owner: %v", err)
	}
}

func TestFeedbackEventDoesNotChurnProfile(t *testing.T) {
	h := newHarness()
	r, err := h.svc.RecordEvent(context.Background(), ariaID, EventInput{CourseID: course, Competency: "Derivatives", Type: "explanation_feedback", Score: 0, IdempotencyKey: "feedback-1", OccurredAt: t0})
	if err != nil || r.Record != nil {
		t.Fatalf("feedback must not recompute: %v %+v", err, r)
	}
	if len(h.mem.Evidence(ariaID)) != 0 {
		t.Fatal("no evidence row expected")
	}
}

func TestUnverifiedPrerequisiteIsAskedNotAssumed(t *testing.T) {
	h := newHarness()
	for _, s := range []float64{0.2, 0.3, 0.1} {
		h.rec(ariaID, course, "Gradient descent", "exercise_submitted", s)
	}
	snap := h.snap(ariaID, course)
	g := openGaps(snap)[0]
	if g.Cause != "current_lesson" || len(g.Unverified) != 1 {
		t.Fatalf("no prerequisite evidence: cause=%s unverified=%v", g.Cause, g.Unverified)
	}
	ok := false
	for _, r := range snap.Recommendations {
		if r.Kind == "verify_prerequisite" && r.Competency == "Derivatives" {
			ok = true
		}
	}
	if !ok {
		t.Fatal("expected a verify_prerequisite recommendation")
	}
}

func TestAIInsightValidation(t *testing.T) {
	valid := map[string]bool{"ev-1": true, "ev-2": true}
	raw := []AIInsight{
		{Kind: "pattern", Statement: "Mistakes cluster around sign errors.", Rationale: "Three tagged mistakes in two exercises.", EvidenceEventIDs: []string{"ev-1"}, Confidence: "medium"},
		{Kind: "pattern", Statement: "Cites an invented event.", Rationale: "Fabricated reference here.", EvidenceEventIDs: []string{"ev-999"}, Confidence: "high"},
		{Kind: "strength", Statement: "You are clearly very intelligent.", Rationale: "High scores overall.", EvidenceEventIDs: []string{"ev-1"}, Confidence: "high"},
		{Kind: "weakness", Statement: "Not an allowed kind here.", Rationale: "Weakness is rules-only.", EvidenceEventIDs: []string{"ev-1"}, Confidence: "high"},
		{Kind: "strategy", Statement: "No evidence given at all.", Rationale: "Missing event ids list.", Confidence: "low"},
		{Kind: "strategy", Statement: "Try worked examples first.", Rationale: "Practice scores trail knowledge checks.", EvidenceEventIDs: []string{"ev-1", "ev-2"}, Confidence: "low"},
	}
	out := ValidateAIInsights(raw, valid, t0)
	if len(out) != 2 {
		t.Fatalf("kept %d: %+v", len(out), out)
	}
	for _, in := range out {
		if in.Source != "ai" || len(in.EvidenceEventIDs) == 0 {
			t.Fatalf("bad insight %+v", in)
		}
	}
}

func TestStoreAIInsightsRejectsInventedEvents(t *testing.T) {
	h := newHarness()
	h.rec(ariaID, course, "Derivatives", "exercise_submitted", 0.4)
	n, err := h.svc.StoreAIInsights(context.Background(), ariaID, course, []AIInsight{
		{Kind: "pattern", Statement: "Invented evidence reference.", Rationale: "This id does not exist.", EvidenceEventIDs: []string{"ev-404"}, Confidence: "high"},
	})
	if err != nil || n != 0 {
		t.Fatalf("n=%d err=%v", n, err)
	}
}

func TestPreferencesValidationAndPrivacyReset(t *testing.T) {
	h := newHarness()
	ctx := context.Background()
	p := DefaultPreferences()
	p.ExplanationStyle = "simple"
	if _, err := h.svc.SavePreferences(ctx, ariaID, p); err != nil {
		t.Fatal(err)
	}
	p.Pace = "warp"
	if _, err := h.svc.SavePreferences(ctx, ariaID, p); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid pace must be rejected")
	}
	h.rec(ariaID, course, "Derivatives", "assessment_result", 0.9)
	if err := h.svc.Reset(ctx, ariaID); err != nil {
		t.Fatal(err)
	}
	snaps, prefs, _ := h.svc.Overview(ctx, ariaID)
	if len(snaps) != 0 || prefs.ExplanationStyle != "balanced" {
		t.Fatal("reset must delete evidence and preferences")
	}
}

func TestInsightCorrection(t *testing.T) {
	h := newHarness()
	for i := 0; i < 4; i++ {
		h.rec(ariaID, course, "Derivatives", "assessment_result", 0.9)
	}
	ins := h.snap(ariaID, course).Insights
	if len(ins) == 0 || ins[0].Kind != "strength" {
		t.Fatalf("expected a strength insight: %+v", ins)
	}
	if err := h.svc.CorrectInsight(context.Background(), ariaID, ins[0].ID, "corrected", "I guessed those"); err != nil {
		t.Fatal(err)
	}
	if err := h.svc.CorrectInsight(context.Background(), budiID, ins[0].ID, "dismissed", ""); !errors.Is(err, ErrNotFound) {
		t.Fatal("another user must not be able to correct this insight")
	}
	// A later recompute must not resurrect the corrected insight as active.
	h.rec(ariaID, course, "Derivatives", "assessment_result", 0.9)
	active := 0
	for _, in := range h.snap(ariaID, course).Insights {
		if in.Source == "rules" && in.Status == "active" && strings.Contains(in.Statement, "Derivatives") {
			active++
		}
	}
	if active != 1 {
		t.Fatalf("expected exactly one active rule insight, got %d", active)
	}
}

func TestRecommendationsAlwaysHaveReasons(t *testing.T) {
	h := newHarness()
	for _, s := range []float64{0.2, 0.3, 0.1} {
		h.rec(ariaID, course, "Gradient descent", "exercise_submitted", s)
	}
	for _, r := range h.snap(ariaID, course).Recommendations {
		if len(r.Reason) < 10 {
			t.Fatalf("recommendation without reason: %+v", r)
		}
	}
}
