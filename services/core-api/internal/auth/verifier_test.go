package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestVerifierAcceptsES256FromJWKS(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"kty": "EC",
				"kid": "test-key",
				"crv": "P-256",
				"x":   base64.RawURLEncoding.EncodeToString(key.X.FillBytes(make([]byte, 32))),
				"y":   base64.RawURLEncoding.EncodeToString(key.Y.FillBytes(make([]byte, 32))),
			}},
		})
	}))
	defer jwks.Close()

	verifier := NewVerifier(jwks.URL, "https://project.supabase.co/auth/v1", "authenticated", "", jwks.Client())
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"sub":   "11111111-1111-1111-1111-111111111111",
		"aud":   "authenticated",
		"iss":   "https://project.supabase.co/auth/v1",
		"exp":   time.Now().Add(time.Hour).Unix(),
		"email": "learner@example.com",
	})
	token.Header["kid"] = "test-key"
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}

	claims, err := verifier.Verify(context.Background(), signed)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if claims.Subject != "11111111-1111-1111-1111-111111111111" {
		t.Fatalf("unexpected subject %q", claims.Subject)
	}
}

func TestVerifierRejectsExpiredWrongAudienceAndUnknownKey(t *testing.T) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"kty": "EC",
				"kid": "known",
				"crv": "P-256",
				"x":   base64.RawURLEncoding.EncodeToString(key.X.FillBytes(make([]byte, 32))),
				"y":   base64.RawURLEncoding.EncodeToString(key.Y.FillBytes(make([]byte, 32))),
			}},
		})
	}))
	defer jwks.Close()
	verifier := NewVerifier(jwks.URL, "issuer", "authenticated", "", jwks.Client())

	cases := []struct {
		name   string
		claims jwt.MapClaims
		kid    string
	}{
		{
			name: "expired",
			claims: jwt.MapClaims{
				"sub": "user", "aud": "authenticated", "iss": "issuer",
				"exp": time.Now().Add(-time.Minute).Unix(),
			},
			kid: "known",
		},
		{
			name: "wrong audience",
			claims: jwt.MapClaims{
				"sub": "user", "aud": "anon", "iss": "issuer",
				"exp": time.Now().Add(time.Hour).Unix(),
			},
			kid: "known",
		},
		{
			name: "wrong issuer",
			claims: jwt.MapClaims{
				"sub": "user", "aud": "authenticated", "iss": "other",
				"exp": time.Now().Add(time.Hour).Unix(),
			},
			kid: "known",
		},
		{
			name: "unknown key",
			claims: jwt.MapClaims{
				"sub": "user", "aud": "authenticated", "iss": "issuer",
				"exp": time.Now().Add(time.Hour).Unix(),
			},
			kid: "unknown",
		},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodES256, test.claims)
			token.Header["kid"] = test.kid
			signed, err := token.SignedString(key)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := verifier.Verify(context.Background(), signed); err == nil {
				t.Fatal("expected verification to fail")
			}
		})
	}
}

func TestVerifierAcceptsHS256Fallback(t *testing.T) {
	verifier := NewVerifier("", "issuer", "authenticated", "test-secret", nil)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "user", "aud": "authenticated", "iss": "issuer",
		"exp": time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := verifier.Verify(context.Background(), signed); err != nil {
		t.Fatalf("verify: %v", err)
	}
}
