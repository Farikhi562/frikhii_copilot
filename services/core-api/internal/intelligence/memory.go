package intelligence

import (
	"context"
	"fmt"
	"strings"
	"sync"
)

// Memory is an in-process Repository used by tests and local development without a
// database. It enforces the same ownership and idempotency rules as the SQL schema.
type Memory struct {
	mu       sync.Mutex
	seq      int
	Courses  map[string]memCourse // courseID -> owner + info
	events   map[string][]Event   // userID -> events
	snaps    map[string]Snapshot  // userID|courseID
	evidence map[string][]EvidenceRow
	prefs    map[string]Preferences
}

type memCourse struct {
	Owner string
	Info  CourseInfo
}

func NewMemory() *Memory {
	return &Memory{Courses: map[string]memCourse{}, events: map[string][]Event{}, snaps: map[string]Snapshot{}, evidence: map[string][]EvidenceRow{}, prefs: map[string]Preferences{}}
}

func (m *Memory) AddCourse(owner string, info CourseInfo) {
	m.Courses[info.CourseID] = memCourse{owner, info}
}
func (m *Memory) nextID(p string) string { m.seq++; return fmt.Sprintf("%s-%04d", p, m.seq) }
func key(u, c string) string             { return u + "|" + c }

func (m *Memory) CourseInfo(_ context.Context, userID, courseID string) (CourseInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.Courses[courseID]
	if !ok || c.Owner != userID {
		return CourseInfo{}, ErrNotFound
	}
	return c.Info, nil
}

func (m *Memory) InsertEvent(_ context.Context, userID string, e Event) (Event, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, x := range m.events[userID] {
		if x.IdempotencyKey == e.IdempotencyKey {
			return x, false, nil
		}
	}
	e.ID = m.nextID("ev")
	m.events[userID] = append(m.events[userID], e)
	return e, true, nil
}

func (m *Memory) ListEvents(_ context.Context, userID, courseID string) ([]Event, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Event
	for _, e := range m.events[userID] {
		if e.CourseID == courseID {
			out = append(out, e)
		}
	}
	return out, nil
}

func (m *Memory) LoadSnapshot(_ context.Context, userID, courseID string) (Snapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.snaps[key(userID, courseID)]
	if !ok {
		return Snapshot{CourseID: courseID, State: State{Records: map[string]Record{}}}, nil
	}
	return s, nil
}

func (m *Memory) LoadAll(_ context.Context, userID string) ([]Snapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Snapshot
	for k, s := range m.snaps {
		if strings.HasPrefix(k, userID+"|") {
			out = append(out, s)
		}
	}
	return out, nil
}

func (m *Memory) SaveSnapshot(_ context.Context, userID string, snap Snapshot, ev []EvidenceRow) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c, ok := m.Courses[snap.CourseID]; !ok || c.Owner != userID {
		return ErrNotFound
	}
	old := m.snaps[key(userID, snap.CourseID)]
	for i := range snap.Gaps {
		if snap.Gaps[i].ID == "" {
			snap.Gaps[i].ID = m.nextID("gap")
		}
	}
	// Keep AI and user-managed insights; replace rule insights.
	var keep []Insight
	for _, in := range old.Insights {
		if in.Source == "ai" || in.Status != "active" {
			keep = append(keep, in)
		}
	}
	for _, in := range snap.RuleInsights {
		in.ID = m.nextID("ins")
		keep = append(keep, in)
	}
	snap.Insights = keep
	m.snaps[key(userID, snap.CourseID)] = snap
	m.evidence[userID] = append(m.evidence[userID], ev...)
	return nil
}

func (m *Memory) GetPreferences(_ context.Context, userID string) (Preferences, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if p, ok := m.prefs[userID]; ok {
		return p, nil
	}
	return DefaultPreferences(), nil
}

func (m *Memory) SavePreferences(_ context.Context, userID string, p Preferences) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.prefs[userID] = p
	return nil
}

func (m *Memory) SetInsightStatus(_ context.Context, userID, id, status, note string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, s := range m.snaps {
		if !strings.HasPrefix(k, userID+"|") {
			continue
		}
		for i := range s.Insights {
			if s.Insights[i].ID == id {
				s.Insights[i].Status, s.Insights[i].UserNote = status, note
				m.snaps[k] = s
				return nil
			}
		}
	}
	return ErrNotFound
}

func (m *Memory) AddInsights(_ context.Context, userID, courseID string, ins []Insight) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.snaps[key(userID, courseID)]
	for _, in := range ins {
		in.ID = m.nextID("ins")
		s.Insights = append(s.Insights, in)
	}
	m.snaps[key(userID, courseID)] = s
	return nil
}

func (m *Memory) Reset(_ context.Context, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.events, userID)
	delete(m.evidence, userID)
	delete(m.prefs, userID)
	for k := range m.snaps {
		if strings.HasPrefix(k, userID+"|") {
			delete(m.snaps, k)
		}
	}
	return nil
}

// Evidence exposes the audit trail to tests.
func (m *Memory) Evidence(userID string) []EvidenceRow {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]EvidenceRow(nil), m.evidence[userID]...)
}
