package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/auth"
	"github.com/frikhii/copilot/core-api/internal/config"
	"github.com/frikhii/copilot/core-api/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
)

type contextKey string

const userContextKey contextKey = "user_id"

type Server struct {
	store    store.Store
	ai       *aiclient.Client
	verifier *auth.Verifier
	cfg      config.Config
}

func New(cfg config.Config, data store.Store, ai *aiclient.Client, verifier *auth.Verifier) *Server {
	return &Server{store: data, ai: ai, verifier: verifier, cfg: cfg}
}

func (s *Server) Router() http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(s.requestLogger)
	router.Use(middleware.Recoverer)
	router.Use(s.cors)
	router.Use(middleware.RequestSize(s.cfg.MaxRequestBytes))

	router.Get("/", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"service":"frikhii-core-api","status":"ok"}`))
	})
	router.Get("/healthz", s.health)
	router.Get("/readyz", s.ready)

	router.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", s.health)

		r.Group(func(authRouter chi.Router) {
			authRouter.Use(s.authenticate)
			authRouter.Use(s.requireStore)

			authRouter.Get("/dashboard", s.getDashboard)
			authRouter.Get("/progress", s.getProgress)

			authRouter.Post("/learning-goals", s.createLearningGoal)
			authRouter.Get("/learning-goals", s.listLearningGoals)
			authRouter.Get("/learning-goals/{goalID}", s.getLearningGoal)
			authRouter.Post("/learning-goals/{goalID}/diagnostic", s.generateDiagnostic)
			authRouter.Get("/learning-goals/{goalID}/diagnostic", s.getDiagnostic)
			authRouter.Post("/learning-goals/{goalID}/diagnostic/submit", s.submitDiagnostic)
			authRouter.Get("/learning-goals/{goalID}/diagnostic/result", s.diagnosticResult)
			authRouter.Post("/learning-goals/{goalID}/generate", s.generateCourse)

			authRouter.Get("/courses", s.listCourses)
			authRouter.Get("/courses/{courseID}", s.getCourse)
			authRouter.Patch("/courses/{courseID}/draft", s.updateDraft)
			authRouter.Post("/courses/{courseID}/regenerate", s.regenerateCourse)
			authRouter.Post("/courses/{courseID}/approve", s.approveCourse)

			authRouter.Post("/courses/{courseID}/lessons/{lessonID}/complete", s.completeLesson)
			authRouter.Get("/courses/{courseID}/lessons/completed", s.getCompletedLessons)

			authRouter.Post("/conversations", s.createConversation)
			authRouter.Get("/conversations", s.listConversations)
			authRouter.Get("/conversations/{conversationID}", s.getConversation)
			authRouter.Patch("/conversations/{conversationID}", s.updateConversation)
			authRouter.Delete("/conversations/{conversationID}", s.deleteConversation)
			authRouter.Post("/conversations/{conversationID}/messages", s.sendMessage)
		})
	})
	return router
}

func (s *Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		requestID := middleware.GetReqID(r.Context())
		if requestID != "" {
			w.Header().Set("X-Request-ID", requestID)
		}
		wrapped := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(wrapped, r)
		userID, _ := r.Context().Value(userContextKey).(string)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", wrapped.Status(),
			"bytes", wrapped.BytesWritten(),
			"duration_ms", time.Since(started).Milliseconds(),
			"request_id", requestID,
			"user_id", userID,
		)
	})
}

func (s *Server) cors(next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, origin := range s.cfg.CORSOrigins {
		allowed[origin] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && allowed[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID")
			w.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			if origin != "" && !allowed[origin] {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.AuthDisabled {
			// Development and tests only. main.go refuses this in production.
			debugUser := strings.TrimSpace(r.Header.Get("X-Debug-User-ID"))
			if _, err := uuid.Parse(debugUser); err != nil {
				writeError(w, r, apiError{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "A valid X-Debug-User-ID is required in auth-disabled mode."})
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey, debugUser)))
			return
		}
		if s.verifier == nil {
			writeError(w, r, apiError{Status: http.StatusServiceUnavailable, Code: "auth_not_configured", Message: "Authentication is not configured on the API."})
			return
		}
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(strings.ToLower(header), "bearer ") {
			writeError(w, r, apiError{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "A bearer access token is required."})
			return
		}
		raw := strings.TrimSpace(header[len("Bearer "):])
		ctx, cancel := context.WithTimeout(r.Context(), 6*time.Second)
		defer cancel()
		claims, err := s.verifier.Verify(ctx, raw)
		if err != nil {
			writeError(w, r, apiError{Status: http.StatusUnauthorized, Code: "invalid_token", Message: "The access token is invalid or expired."})
			return
		}
		if _, err := uuid.Parse(claims.Subject); err != nil {
			writeError(w, r, apiError{Status: http.StatusUnauthorized, Code: "invalid_token", Message: "The access token has no valid user subject."})
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey, claims.Subject)))
	})
}

func (s *Server) requireStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.store == nil {
			writeError(w, r, store.ErrUnavailable)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func userID(r *http.Request) string {
	value, _ := r.Context().Value(userContextKey).(string)
	return value
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "frikhii-core-api",
	})
}

type readyChecks struct {
	Database       bool `json:"database"`
	AIAttached     bool `json:"ai_attached"`
	AIConfigured   bool `json:"ai_configured"`
	AIMockProvider bool `json:"ai_mock_provider"`
	AuthConfigured bool `json:"auth_configured"`
	AuthDisabled   bool `json:"auth_disabled"`
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	checks := readyChecks{
		Database:       s.store != nil,
		AIAttached:     s.ai != nil,
		AIConfigured:   s.ai != nil && s.ai.Configured(),
		AuthConfigured: s.verifier != nil,
		AuthDisabled:   s.cfg.AuthDisabled,
	}
	if s.store != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		checks.Database = s.store.Ping(ctx) == nil
	}
	if s.ai != nil && s.ai.Configured() {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		checks.AIAttached = s.ai.Health(ctx)
		if checks.AIAttached {
			if mock, ok := s.ai.MockProvider(ctx); ok {
				checks.AIMockProvider = mock
			}
		}
		cancel()
	}
	status := http.StatusOK
	state := "ready"
	if !checks.Database || !checks.AIConfigured || (!checks.AuthConfigured && !checks.AuthDisabled) {
		status = http.StatusServiceUnavailable
		state = "degraded"
	}
	writeJSON(w, status, map[string]any{"status": state, "checks": checks})
}
