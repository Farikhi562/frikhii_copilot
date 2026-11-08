package intelligence

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"
)

const (
	recencyDecay      = 0.75 // each older event counts 75% of the next newer one
	minEvidenceFor    = 3    // fewer points never exceed "learning"
	minEvidenceMaster = 5
	gapWindow         = 4
	gapFailScore      = 0.5
)

func clamp01(v float64) float64 { return math.Max(0, math.Min(1, v)) }
func round3(v float64) float64  { return math.Round(v*1000) / 1000 }

func norm(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// scored returns the events that carry mastery weight, oldest first.
func scored(events []Event) []Event {
	out := make([]Event, 0, len(events))
	for _, e := range events {
		if EventTypes[e.Type] > 0 {
			out = append(out, e)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].OccurredAt.Before(out[j].OccurredAt) })
	return out
}

// ComputeRecord derives mastery for one competency from its events, deterministically.
//
// Mastery is a recency-weighted mean of event scores (newer evidence counts more, harder
// and more reliable event types count more). A single correct answer can never exceed
// "learning"; "mastered" needs five evidence points, decent confidence and recent
// strong results. Historical peak is kept so a later regression stays visible.
func ComputeRecord(competency string, events []Event) Record {
	rec := Record{Competency: competency, Status: StatusNotStarted, CommonMistakes: []MistakeCount{}, AccuracyHistory: []AccuracyPoint{}}
	ev := scored(events)
	if len(ev) == 0 {
		return rec
	}
	mistakes := map[string]int{}
	var num, den float64
	peak := 0.0
	for i := range ev {
		// Running mastery after event i, for the history and the peak.
		var n, d float64
		for j := 0; j <= i; j++ {
			age := float64(i - j)
			w := math.Pow(recencyDecay, age) * EventTypes[ev[j].Type] * difficultyWeight[orMedium(ev[j].Difficulty)]
			n += w * ev[j].Score
			d += w
		}
		m := n / d
		if i+1 >= minEvidenceFor && m > peak {
			peak = m
		}
		rec.AccuracyHistory = append(rec.AccuracyHistory, AccuracyPoint{At: ev[i].OccurredAt, Score: round3(ev[i].Score), Mastery: round3(m)})
		num, den = n, d
	}
	for _, e := range events { // mistakes come from every event, including unweighted ones
		for _, t := range e.MistakeTags {
			if t = strings.TrimSpace(t); t != "" {
				mistakes[t]++
			}
		}
	}
	mastery := num / den
	rec.Mastery = round3(mastery)
	rec.PeakMastery = round3(peak)
	rec.Attempts = len(ev)
	last := ev[len(ev)-1]
	t := last.OccurredAt
	rec.LastEventAt = &t
	for _, e := range ev {
		if e.Score >= 0.7 {
			rec.CorrectAttempts++
			at := e.OccurredAt
			rec.LastDemonstratedAt = &at
		}
	}
	rec.CommonMistakes = topMistakes(mistakes, 5)

	// Confidence: grows with evidence count, shrinks when results are inconsistent.
	mean := 0.0
	for _, e := range ev {
		mean += e.Score
	}
	mean /= float64(len(ev))
	var variance float64
	for _, e := range ev {
		variance += (e.Score - mean) * (e.Score - mean)
	}
	std := math.Sqrt(variance / float64(len(ev)))
	rec.Confidence = round3(clamp01(math.Min(1, float64(len(ev))/5.0) * (1 - math.Min(0.5, std))))

	rec.Status = statusFor(mastery, len(ev), rec.Confidence, ev)
	// Regression: previously solid, and the latest retention check failed.
	if last.Type == "retention_check" && last.Score < gapFailScore && peak >= 0.7 {
		rec.Regression = true
	}
	return rec
}

func orMedium(d string) string {
	if d == "" {
		return "medium"
	}
	return d
}

func statusFor(mastery float64, n int, confidence float64, ev []Event) string {
	if n < minEvidenceFor {
		return StatusLearning
	}
	switch {
	case mastery >= 0.85 && n >= minEvidenceMaster && confidence >= 0.6 && recentStrong(ev, 2, 0.8):
		return StatusMastered
	case mastery >= 0.7:
		return StatusProficient
	case mastery >= 0.5:
		return StatusDeveloping
	default:
		return StatusLearning
	}
}

func recentStrong(ev []Event, n int, min float64) bool {
	if len(ev) < n {
		return false
	}
	for _, e := range ev[len(ev)-n:] {
		if e.Score < min {
			return false
		}
	}
	return true
}

func topMistakes(m map[string]int, limit int) []MistakeCount {
	out := make([]MistakeCount, 0, len(m))
	for k, v := range m {
		out = append(out, MistakeCount{Tag: k, Count: v})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count != out[j].Count {
			return out[i].Count > out[j].Count
		}
		return out[i].Tag < out[j].Tag
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// DetectGap decides whether a competency currently shows a knowledge gap.
// It needs repeated evidence: at least three of the last four scored events failed,
// or the recency-weighted mastery is low with at least three evidence points.
func DetectGap(rec Record, events []Event, info CourseInfo, records map[string]Record) *Gap {
	ev := scored(events)
	if len(ev) < minEvidenceFor {
		return nil
	}
	window := ev
	if len(window) > gapWindow {
		window = window[len(window)-gapWindow:]
	}
	fails := 0
	var ids []string
	for _, e := range window {
		if e.Score < gapFailScore {
			fails++
			ids = append(ids, e.ID)
		}
	}
	repeated := fails >= 3
	low := rec.Mastery < 0.45
	retention := rec.Regression
	if !repeated && !low && !retention {
		return nil
	}
	if len(ids) == 0 { // low mastery without a recent hard failure: cite the window
		for _, e := range window {
			ids = append(ids, e.ID)
		}
	}
	cause := "current_lesson"
	var weakPre, unverified []string
	for _, p := range info.Prerequisites[rec.Competency] {
		pr, ok := records[p]
		if !ok || pr.Attempts == 0 {
			unverified = append(unverified, p)
			continue
		}
		if pr.Mastery < 0.5 && pr.Attempts >= 2 {
			weakPre = append(weakPre, p)
		}
	}
	if retention {
		cause = "retention"
	} else if len(weakPre) > 0 {
		cause = "prerequisite"
	}
	severity := "low"
	switch {
	case rec.Mastery < 0.3:
		severity = "high"
	case rec.Mastery < 0.45 || retention:
		severity = "medium"
	}
	summary := fmt.Sprintf("%d of the last %d scored attempts on %q were below 50%% (current estimate %d%%, %d attempts).",
		fails, len(window), rec.Competency, int(math.Round(rec.Mastery*100)), rec.Attempts)
	if retention {
		summary = fmt.Sprintf("A retention check on %q failed after earlier solid results (earlier peak %d%%, now %d%%).",
			rec.Competency, int(math.Round(rec.PeakMastery*100)), int(math.Round(rec.Mastery*100)))
	}
	rem := fmt.Sprintf("Review the core idea of %q with a worked example, then retry a short practice set.", rec.Competency)
	switch cause {
	case "prerequisite":
		rem = fmt.Sprintf("Revisit %s first, then return to %q.", strings.Join(weakPre, ", "), rec.Competency)
	case "retention":
		rem = fmt.Sprintf("Do a short retrieval exercise on %q, then re-check it in a few days.", rec.Competency)
	}
	last := ev[len(ev)-1].OccurredAt
	return &Gap{
		Competency: rec.Competency, Severity: severity, Confidence: rec.Confidence, Cause: cause,
		Prerequisites: weakPre, Unverified: unverified, EvidenceEventIDs: ids,
		EvidenceSummary: summary, Recommendation: rem, Status: "open", OpenedAt: last, LastEvidenceAt: last,
	}
}

// ReconcileGap updates an existing unresolved gap against new evidence. A gap is
// "improving" once mastery recovers above 50%, and "resolved" only when mastery is at
// least 70%, the last two scored results are at least 70%, and at least two scored
// attempts happened after the gap was opened.
func ReconcileGap(existing Gap, rec Record, events []Event, now time.Time) Gap {
	ev := scored(events)
	after := 0
	for _, e := range ev {
		if e.OccurredAt.After(existing.OpenedAt) {
			after++
		}
	}
	existing.LastEvidenceAt = now
	if len(ev) > 0 {
		existing.LastEvidenceAt = ev[len(ev)-1].OccurredAt
	}
	switch {
	case rec.Mastery >= 0.7 && recentStrong(ev, 2, 0.7) && after >= 2 && !rec.Regression:
		t := existing.LastEvidenceAt
		existing.Status = "resolved"
		existing.ResolvedAt = &t
		existing.EvidenceSummary = fmt.Sprintf("Resolved: the latest results on %q are strong (current estimate %d%% after %d newer attempts).",
			rec.Competency, int(math.Round(rec.Mastery*100)), after)
	case rec.Mastery >= 0.5:
		existing.Status = "improving"
	default:
		existing.Status = "open"
	}
	existing.Confidence = rec.Confidence
	return existing
}

// NextReview schedules spaced review. Strong results lengthen the interval; a failed
// check resets it to one day.
func NextReview(prev *ReviewItem, rec Record, now time.Time) *ReviewItem {
	if rec.Status != StatusProficient && rec.Status != StatusMastered && !rec.Regression {
		return nil
	}
	ladder := []int{1, 3, 7, 14, 30, 60}
	reps := 0
	if prev != nil {
		reps = prev.Repetitions
	}
	last := rec.AccuracyHistory[len(rec.AccuracyHistory)-1].Score
	if rec.Regression || last < gapFailScore {
		reps = 0
	} else if prev != nil {
		reps++
	}
	if reps >= len(ladder) {
		reps = len(ladder) - 1
	}
	days := ladder[reps]
	return &ReviewItem{Competency: rec.Competency, IntervalDays: days, Repetitions: reps, DueAt: now.Add(time.Duration(days) * 24 * time.Hour)}
}

// Recommend produces ordered next actions, each with a reason built from real numbers.
func Recommend(info CourseInfo, records map[string]Record, gaps []Gap, reviews []ReviewItem, now time.Time) []Recommendation {
	var out []Recommendation
	add := func(kind, comp, title, reason string, p int) {
		out = append(out, Recommendation{Kind: kind, Competency: comp, Title: title, Reason: reason, Priority: p})
	}
	handled := map[string]bool{}
	for _, g := range gaps {
		if g.Status == "resolved" {
			continue
		}
		handled[norm(g.Competency)] = true
		switch g.Cause {
		case "prerequisite":
			add("review_prerequisite", g.Prerequisites[0], "Strengthen "+g.Prerequisites[0],
				fmt.Sprintf("Before continuing with %s, review %s. %s Strengthening it should make %s easier.", g.Competency, strings.Join(g.Prerequisites, ", "), g.EvidenceSummary, g.Competency), 5)
		case "retention":
			add("review_retention", g.Competency, "Refresh "+g.Competency, g.EvidenceSummary+" A short retrieval exercise is the best next step.", 10)
		default:
			add("remediate", g.Competency, "Work through "+g.Competency+" again", g.EvidenceSummary+" "+g.Recommendation, 15)
		}
		for _, u := range g.Unverified {
			add("verify_prerequisite", u, "Check your grounding in "+u,
				fmt.Sprintf("%s depends on %s, and there is no evidence about %s yet. A quick check will show whether it needs review.", g.Competency, u, u), 25)
		}
	}
	for _, r := range reviews {
		if !r.DueAt.After(now) && !handled[norm(r.Competency)] {
			add("review_retention", r.Competency, "Review "+r.Competency,
				fmt.Sprintf("%s is due for a spaced review (interval %d days). Revisiting it keeps what you learned from fading.", r.Competency, r.IntervalDays), 30)
		}
	}
	// Next competency in course order that is not yet solid.
	for _, c := range info.Competencies {
		rec, ok := records[c]
		if handled[norm(c)] {
			continue
		}
		if !ok || rec.Status == StatusNotStarted {
			add("practice", c, "Start "+c, "You have no recorded evidence for "+c+" yet, and it is next in the course.", 40)
			break
		}
		if rec.Status == StatusLearning || rec.Status == StatusDeveloping {
			add("practice", c, "Practise "+c,
				fmt.Sprintf("%s is still %s (%d%% estimated from %d attempts). More guided practice should help.", c, rec.Status, int(math.Round(rec.Mastery*100)), rec.Attempts), 35)
			break
		}
	}
	// Readiness / challenge when everything seen is solid.
	solid, seen := 0, 0
	for _, c := range info.Competencies {
		if r, ok := records[c]; ok && r.Attempts > 0 {
			seen++
			if r.Status == StatusProficient || r.Status == StatusMastered {
				solid++
			}
		}
	}
	hasOpen := false
	for _, g := range gaps {
		if g.Status != "resolved" {
			hasOpen = true
		}
	}
	if seen > 0 && solid == seen && !hasOpen {
		add("advance", "", "Move on to the next class",
			fmt.Sprintf("All %d competencies with evidence are proficient or better and no knowledge gaps are open.", seen), 20)
		for _, c := range info.Competencies {
			if r, ok := records[c]; ok && r.Status == StatusMastered {
				add("challenge", c, "Try an application challenge on "+c,
					fmt.Sprintf("Your recent results on %s are consistently strong (%d%% over %d attempts), so harder, applied problems fit better than repeating the basics.", c, int(math.Round(r.Mastery*100)), r.Attempts), 45)
				break
			}
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Priority < out[j].Priority })
	if len(out) > 8 {
		out = out[:8]
	}
	return out
}

// RuleInsights builds strengths and recurring-mistake patterns directly from evidence.
func RuleInsights(records map[string]Record, eventsByComp map[string][]Event, now time.Time) []Insight {
	var out []Insight
	names := make([]string, 0, len(records))
	for k := range records {
		names = append(names, k)
	}
	sort.Strings(names)
	for _, name := range names {
		r := records[name]
		ids := lastIDs(eventsByComp[name], 4)
		if len(ids) == 0 {
			continue
		}
		if (r.Status == StatusProficient || r.Status == StatusMastered) && r.Confidence >= 0.5 {
			out = append(out, Insight{Kind: "strength", Source: "rules", Status: "active", CreatedAt: now, EvidenceEventIDs: ids,
				Confidence: confLabel(r.Confidence),
				Statement:  fmt.Sprintf("You are %s in %s.", r.Status, name),
				Rationale:  fmt.Sprintf("Estimated %d%% from %d scored attempts, with %d of them at 70%% or above.", int(math.Round(r.Mastery*100)), r.Attempts, r.CorrectAttempts)})
		}
		for _, m := range r.CommonMistakes {
			if m.Count >= 3 {
				out = append(out, Insight{Kind: "pattern", Source: "rules", Status: "active", CreatedAt: now, EvidenceEventIDs: ids,
					Confidence: "medium",
					Statement:  fmt.Sprintf("A recurring mistake in %s: %s.", name, m.Tag),
					Rationale:  fmt.Sprintf("This mistake was tagged %d times across your attempts on %s.", m.Count, name)})
				break
			}
		}
	}
	return out
}

func lastIDs(events []Event, n int) []string {
	ev := scored(events)
	if len(ev) > n {
		ev = ev[len(ev)-n:]
	}
	ids := make([]string, 0, len(ev))
	for _, e := range ev {
		ids = append(ids, e.ID)
	}
	return ids
}

func confLabel(c float64) string {
	switch {
	case c >= 0.75:
		return "high"
	case c >= 0.45:
		return "medium"
	default:
		return "low"
	}
}

// Approach picks a teaching strategy from evidence only. Order matters: a retention
// regression and prerequisite gaps outrank everything, then a theory/practice split,
// then sustained strong performance.
type TutorGuidance struct {
	Approach    string   `json:"approach"` // retrieval_review | prerequisite_first | worked_examples | challenge | standard
	Focus       string   `json:"focus"`
	Reasons     []string `json:"reasons"`
	Strengths   []string `json:"strengths"`
	ReviewFirst []string `json:"review_first"`
	Skip        []string `json:"avoid_repeating"`
	Style       struct {
		Explanation string `json:"explanation"`
		Examples    string `json:"examples"`
		Pace        string `json:"pace"`
		Language    string `json:"language"`
	} `json:"style"`
	Certainty string `json:"certainty"` // low when there is little evidence
}

func BuildGuidance(competency string, records map[string]Record, gaps []Gap, eventsByComp map[string][]Event, prefs Preferences) TutorGuidance {
	g := TutorGuidance{Approach: "standard", Focus: competency, Reasons: []string{}, Strengths: []string{}, ReviewFirst: []string{}, Skip: []string{}}
	g.Style.Explanation, g.Style.Examples, g.Style.Pace, g.Style.Language = prefs.ExplanationStyle, prefs.ExampleStyle, prefs.Pace, prefs.PreferredLanguage
	rec, have := records[competency]
	g.Certainty = "low"
	if have && rec.Confidence >= 0.5 {
		g.Certainty = "medium"
	}
	if have && rec.Confidence >= 0.75 {
		g.Certainty = "high"
	}
	for _, name := range sortedKeys(records) {
		r := records[name]
		if (r.Status == StatusProficient || r.Status == StatusMastered) && r.Confidence >= 0.5 {
			g.Strengths = append(g.Strengths, name)
		}
		if r.Status == StatusMastered && !r.Regression {
			g.Skip = append(g.Skip, name)
		}
	}
	var open *Gap
	for i := range gaps {
		if norm(gaps[i].Competency) == norm(competency) && gaps[i].Status != "resolved" {
			open = &gaps[i]
		}
	}
	switch {
	case have && rec.Regression:
		g.Approach = "retrieval_review"
		g.Reasons = append(g.Reasons, "The learner did well on this earlier but a recent retention check was missed.")
	case open != nil && open.Cause == "prerequisite":
		g.Approach = "prerequisite_first"
		g.ReviewFirst = open.Prerequisites
		g.Reasons = append(g.Reasons, "Repeated difficulty here appears linked to unresolved prerequisites: "+strings.Join(open.Prerequisites, ", ")+".")
	case have && theoryPracticeSplit(eventsByComp[competency]):
		g.Approach = "worked_examples"
		g.Reasons = append(g.Reasons, "The learner scores noticeably lower on practice than on knowledge checks, so concrete worked examples should help more than abstract explanation.")
	case have && rec.Status == StatusMastered && !rec.Regression:
		g.Approach = "challenge"
		g.Reasons = append(g.Reasons, "Recent results are consistently strong; skip the basics and offer applied problems.")
	case open != nil:
		g.Approach = "worked_examples"
		g.Reasons = append(g.Reasons, "There is repeated difficulty here: explain simply, give a worked example, then a guided attempt.")
	}
	if !have || rec.Attempts == 0 {
		g.Reasons = append(g.Reasons, "No learning evidence exists for this topic yet, so personalisation relies on stated preferences only.")
	}
	return g
}

func sortedKeys(m map[string]Record) []string {
	k := make([]string, 0, len(m))
	for n := range m {
		k = append(k, n)
	}
	sort.Strings(k)
	return k
}

// theoryPracticeSplit is true when knowledge checks average at least 0.25 above practice.
func theoryPracticeSplit(events []Event) bool {
	var t, p []float64
	for _, e := range events {
		switch e.Type {
		case "assessment_result", "lesson_completed":
			t = append(t, e.Score)
		case "exercise_submitted", "remediation_completed":
			p = append(p, e.Score)
		}
	}
	if len(t) < 2 || len(p) < 2 {
		return false
	}
	return avg(t)-avg(p) >= 0.25
}

func avg(v []float64) float64 {
	s := 0.0
	for _, x := range v {
		s += x
	}
	return s / float64(len(v))
}
