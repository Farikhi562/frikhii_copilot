package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/frikhii/copilot/core-api/internal/aiclient"
	"github.com/frikhii/copilot/core-api/internal/auth"
	"github.com/frikhii/copilot/core-api/internal/config"
	"github.com/frikhii/copilot/core-api/internal/httpapi"
	"github.com/frikhii/copilot/core-api/internal/store"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
	level := slog.LevelInfo
	switch strings.ToLower(cfg.LogLevel) {
	case "debug":
		level = slog.LevelDebug
	case "warn", "warning":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	var data store.Store
	if cfg.DatabaseURL == "" {
		slog.Warn("DATABASE_URL is not set; the API is starting in degraded mode")
	} else {
		postgres, err := store.NewPostgres(ctx, cfg.DatabaseURL)
		if err != nil {
			slog.Error("database connection failed", "error", err)
			os.Exit(1)
		}
		defer postgres.Close()
		data = postgres
	}

	var verifier *auth.Verifier
	if !cfg.AuthDisabled {
		if cfg.SupabaseJWKSURL != "" || cfg.SupabaseJWTSecret != "" {
			verifier = auth.NewVerifier(cfg.SupabaseJWKSURL, cfg.SupabaseJWTIssuer, cfg.SupabaseJWTAud, cfg.SupabaseJWTSecret, nil)
		} else {
			slog.Warn("neither SUPABASE_URL nor SUPABASE_JWT_SECRET is set; authenticated endpoints will return 503")
		}
	} else {
		slog.Warn("AUTH_DISABLED is enabled; only use this outside production")
	}

	var ai *aiclient.Client
	if cfg.AIEngineURL != "" && cfg.InternalServiceToken != "" {
		ai = aiclient.New(cfg.AIEngineURL, cfg.InternalServiceToken, cfg.AIGenerationTimeout+10*time.Second)
	} else {
		slog.Warn("AI_ENGINE_URL or INTERNAL_SERVICE_TOKEN is not set; generation endpoints are unavailable")
	}

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.New(cfg, data, ai, verifier).Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      cfg.AIGenerationTimeout + 30*time.Second,
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		slog.Info("core api listening", "port", cfg.Port, "env", cfg.AppEnv)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server failed", "error", err)
			stop()
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
}
