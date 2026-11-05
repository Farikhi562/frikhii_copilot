package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/store"
	"github.com/go-chi/chi/v5/middleware"
)

type apiError struct {
	Status  int    `json:"-"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

func (e apiError) Error() string { return e.Message }

func writeError(w http.ResponseWriter, r *http.Request, err error) {
	var api apiError
	switch {
	case errors.As(err, &api):
	case errors.Is(err, store.ErrNotFound):
		api = apiError{Status: http.StatusNotFound, Code: "not_found", Message: "The requested resource was not found."}
	case errors.Is(err, store.ErrConflict):
		api = apiError{Status: http.StatusConflict, Code: "conflict", Message: "The resource is not in a state that allows this action."}
	case errors.Is(err, store.ErrInvalidState):
		api = apiError{Status: http.StatusConflict, Code: "invalid_state", Message: "The request is not valid for the current state."}
	case errors.Is(err, store.ErrGenerationInProgress):
		api = apiError{Status: http.StatusConflict, Code: "generation_in_progress", Message: "Generation is already running. Refresh in a moment."}
	case errors.Is(err, store.ErrUnavailable):
		api = apiError{Status: http.StatusServiceUnavailable, Code: "storage_unavailable", Message: "The data store is not configured."}
	case errors.Is(err, aiclient.ErrTimeout):
		api = apiError{Status: http.StatusGatewayTimeout, Code: "ai_timeout", Message: "The AI service did not respond in time. You can retry."}
	case errors.Is(err, aiclient.ErrRateLimited):
		api = apiError{Status: http.StatusTooManyRequests, Code: "ai_rate_limited", Message: "The AI provider is rate limiting requests. Try again shortly."}
	case errors.Is(err, aiclient.ErrInvalid):
		api = apiError{Status: http.StatusUnprocessableEntity, Code: "invalid_generated_content", Message: "The AI returned content that did not pass validation. You can retry."}
	case errors.Is(err, aiclient.ErrUnavailable), errors.Is(err, aiclient.ErrNotConfigured):
		api = apiError{Status: http.StatusBadGateway, Code: "ai_unavailable", Message: "The AI service is unavailable right now."}
	default:
		api = apiError{Status: http.StatusInternalServerError, Code: "internal_error", Message: "Something went wrong."}
	}

	requestID := middleware.GetReqID(r.Context())
	body := map[string]any{
		"error": map[string]any{
			"code":    api.Code,
			"message": api.Message,
		},
	}
	if api.Details != nil {
		body["error"].(map[string]any)["details"] = api.Details
	}
	if requestID != "" {
		body["error"].(map[string]any)["request_id"] = requestID
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(api.Status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 512*1024)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return apiError{
			Status:  http.StatusBadRequest,
			Code:    "invalid_request_body",
			Message: "The request body is invalid.",
			Details: decodeDetail(err),
		}
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return apiError{Status: http.StatusBadRequest, Code: "invalid_request_body", Message: "The request body must contain a single JSON object."}
	}
	return nil
}

func decodeDetail(err error) string {
	message := err.Error()
	if len(message) > 180 {
		message = message[:180]
	}
	if strings.Contains(message, "unknown field") {
		return "The request contains an unsupported field."
	}
	return message
}

func logServerError(r *http.Request, err error) {
	slog.Error("request_failed", "error", err, "method", r.Method, "path", r.URL.Path, "request_id", middleware.GetReqID(r.Context()))
}
