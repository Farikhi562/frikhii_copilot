package httpapi

import (
	"net/http"

	"github.com/frikhii/copilot/core-api/internal/intelligence"
)

// WithIntelligence enables the Phase 04 learner-intelligence routes. Pass nil to leave
// them disabled (for example when no database is configured).
func (s *Server) WithIntelligence(h *intelligence.Handler) *Server {
	s.intel = h
	return s
}

// UserID returns the authenticated user id set by the authenticate middleware.
func UserID(r *http.Request) string { return userID(r) }
