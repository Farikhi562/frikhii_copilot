package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv      string
	Port        string
	LogLevel    string
	CORSOrigins []string

	SupabaseURL       string
	SupabaseJWKSURL   string
	SupabaseJWTSecret string
	SupabaseJWTAud    string
	SupabaseJWTIssuer string
	AuthDisabled      bool

	DatabaseURL string

	AIEngineURL          string
	InternalServiceToken string
	AITimeout            time.Duration
	AIGenerationTimeout  time.Duration
	MaxRequestBytes      int64
	GenerationStaleAfter time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		AppEnv:               env("APP_ENV", "development"),
		Port:                 env("PORT", "8080"),
		LogLevel:             env("LOG_LEVEL", "info"),
		CORSOrigins:          splitCSV(env("CORS_ORIGINS", "http://localhost:5173")),
		SupabaseURL:          strings.TrimRight(strings.TrimSpace(os.Getenv("SUPABASE_URL")), "/"),
		SupabaseJWKSURL:      strings.TrimSpace(os.Getenv("SUPABASE_JWKS_URL")),
		SupabaseJWTSecret:    strings.TrimSpace(os.Getenv("SUPABASE_JWT_SECRET")),
		SupabaseJWTAud:       env("SUPABASE_JWT_AUD", "authenticated"),
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		AIEngineURL:          strings.TrimRight(strings.TrimSpace(os.Getenv("AI_ENGINE_URL")), "/"),
		InternalServiceToken: strings.TrimSpace(os.Getenv("INTERNAL_SERVICE_TOKEN")),
		MaxRequestBytes:      int64(envInt("MAX_REQUEST_BYTES", 262144)),
	}
	cfg.SupabaseJWTIssuer = env("SUPABASE_JWT_ISSUER", "")
	if cfg.SupabaseURL != "" && cfg.SupabaseJWTIssuer == "" {
		cfg.SupabaseJWTIssuer = cfg.SupabaseURL + "/auth/v1"
	}
	if cfg.SupabaseJWKSURL == "" && cfg.SupabaseURL != "" {
		cfg.SupabaseJWKSURL = cfg.SupabaseURL + "/auth/v1/.well-known/jwks.json"
	}
	cfg.AuthDisabled = envBool("AUTH_DISABLED", false)
	cfg.AITimeout = time.Duration(envInt("AI_TIMEOUT_SECONDS", 120)) * time.Second
	cfg.AIGenerationTimeout = time.Duration(envInt("AI_GENERATION_TIMEOUT_SECONDS", 240)) * time.Second
	cfg.GenerationStaleAfter = time.Duration(envInt("GENERATION_STALE_SECONDS", 600)) * time.Second

	if cfg.AppEnv == "production" && cfg.AuthDisabled {
		return Config{}, fmt.Errorf("AUTH_DISABLED is not allowed in production")
	}
	if cfg.AppEnv == "production" && len(cfg.CORSOrigins) == 0 {
		return Config{}, fmt.Errorf("CORS_ORIGINS must be set in production")
	}
	return cfg, nil
}

func env(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value == "1" || strings.EqualFold(value, "true")
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			result = append(result, part)
		}
	}
	return result
}
