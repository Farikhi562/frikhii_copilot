package domain

import "time"

type Conversation struct {
	ID          string    `json:"id"`
	UserID      string    `json:"-"`
	Title       string    `json:"title"`
	TutorMode   string    `json:"tutor_mode"`
	ContextType *string   `json:"context_type,omitempty"`
	ContextID   *string   `json:"context_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Message struct {
	ID             string         `json:"id"`
	ConversationID string         `json:"conversation_id"`
	UserID         string         `json:"-"`
	Role           string         `json:"role"`
	Content        string         `json:"content"`
	Model          string         `json:"model"`
	TokenUsage     map[string]any `json:"token_usage,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}

type ConversationDetail struct {
	Conversation
	Messages []Message `json:"messages"`
}

type CreateConversationInput struct {
	Title       string  `json:"title"`
	TutorMode   string  `json:"tutor_mode"`
	ContextType *string `json:"context_type,omitempty"`
	ContextID   *string `json:"context_id,omitempty"`
}

type UpdateConversationInput struct {
	Title     *string `json:"title,omitempty"`
	TutorMode *string `json:"tutor_mode,omitempty"`
}

type CreateMessageInput struct {
	Content string         `json:"content"`
	Context map[string]any `json:"context,omitempty"`
}

type DashboardData struct {
	TotalGoals      int             `json:"total_goals"`
	TotalCourses    int             `json:"total_courses"`
	ApprovedCourses int             `json:"approved_courses"`
	DraftCourses    int             `json:"draft_courses"`
	RecentGoal      *LearningGoal   `json:"recent_goal,omitempty"`
	ActiveCourse    *CourseSummary  `json:"active_course,omitempty"`
	CompletedLessonCount int        `json:"completed_lessons_count"`
	TotalStudyTimeMinutes int       `json:"total_study_time_minutes"`
}

type ProgressData struct {
	EnrolledCourses   []CourseSummary `json:"enrolled_courses"`
	CompletedLessonIDs []string       `json:"completed_lesson_ids"`
	TotalLessons      int             `json:"total_lessons"`
	CompletedLessons  int             `json:"completed_lessons"`
	TotalClasses      int             `json:"total_classes"`
	TotalModules      int             `json:"total_modules"`
}
