package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrMissingToken = errors.New("missing bearer token")
	ErrInvalidToken = errors.New("invalid token")
	ErrUnknownKey   = errors.New("unknown signing key")
)

type Claims struct {
	Subject string
	Email   string
	Role    string
}

type Verifier struct {
	jwksURL   string
	issuer    string
	audience  string
	secret    []byte
	http      *http.Client
	mu        sync.RWMutex
	keys      map[string]any
	fetchedAt time.Time
}

const jwksTTL = time.Hour

func NewVerifier(jwksURL, issuer, audience, secret string, client *http.Client) *Verifier {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &Verifier{
		jwksURL:  jwksURL,
		issuer:   issuer,
		audience: audience,
		secret:   []byte(secret),
		http:     client,
		keys:     map[string]any{},
	}
}

func (v *Verifier) Verify(ctx context.Context, rawToken string) (Claims, error) {
	if strings.TrimSpace(rawToken) == "" {
		return Claims{}, ErrMissingToken
	}
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{"ES256", "RS256", "HS256"}),
		jwt.WithExpirationRequired(),
	)
	var claims jwt.MapClaims
	token, err := parser.ParseWithClaims(rawToken, &claims, func(token *jwt.Token) (any, error) {
		switch token.Method.Alg() {
		case "HS256":
			if len(v.secret) == 0 {
				return nil, ErrUnknownKey
			}
			return v.secret, nil
		case "ES256", "RS256":
			kid, _ := token.Header["kid"].(string)
			if kid == "" {
				return nil, ErrUnknownKey
			}
			key, err := v.key(ctx, kid)
			if err != nil {
				return nil, err
			}
			return key, nil
		default:
			return nil, ErrUnknownKey
		}
	})
	if err != nil || !token.Valid {
		return Claims{}, ErrInvalidToken
	}
	if v.issuer != "" {
		issuer, _ := claims.GetIssuer()
		if issuer != v.issuer {
			return Claims{}, ErrInvalidToken
		}
	}
	if v.audience != "" {
		audiences, err := claims.GetAudience()
		if err != nil || !contains(audiences, v.audience) {
			return Claims{}, ErrInvalidToken
		}
	}
	subject, _ := claims.GetSubject()
	if subject == "" {
		return Claims{}, ErrInvalidToken
	}
	email, _ := claims["email"].(string)
	role, _ := claims["role"].(string)
	return Claims{Subject: subject, Email: email, Role: role}, nil
}

func (v *Verifier) key(ctx context.Context, kid string) (any, error) {
	v.mu.RLock()
	key, ok := v.keys[kid]
	fresh := time.Since(v.fetchedAt) < jwksTTL
	v.mu.RUnlock()
	if ok && fresh {
		return key, nil
	}
	if err := v.refresh(ctx); err != nil {
		if ok {
			return key, nil // serve a cached key while the identity provider is unreachable
		}
		return nil, err
	}
	v.mu.RLock()
	defer v.mu.RUnlock()
	key, ok = v.keys[kid]
	if !ok {
		return nil, ErrUnknownKey
	}
	return key, nil
}

type jwksDocument struct {
	Keys []struct {
		Kty string `json:"kty"`
		Kid string `json:"kid"`
		Crv string `json:"crv"`
		X   string `json:"x"`
		Y   string `json:"y"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func (v *Verifier) refresh(ctx context.Context) error {
	if v.jwksURL == "" {
		return ErrUnknownKey
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURL, nil)
	if err != nil {
		return err
	}
	response, err := v.http.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("jwks endpoint returned %d", response.StatusCode)
	}
	var document jwksDocument
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		return err
	}
	keys := make(map[string]any, len(document.Keys))
	for _, item := range document.Keys {
		if item.Kid == "" {
			continue
		}
		switch item.Kty {
		case "EC":
			if item.Crv != "P-256" {
				continue
			}
			x, errX := base64.RawURLEncoding.DecodeString(item.X)
			y, errY := base64.RawURLEncoding.DecodeString(item.Y)
			if errX != nil || errY != nil {
				continue
			}
			keys[item.Kid] = &ecdsa.PublicKey{
				Curve: elliptic.P256(),
				X:     new(big.Int).SetBytes(x),
				Y:     new(big.Int).SetBytes(y),
			}
		case "RSA":
			n, errN := base64.RawURLEncoding.DecodeString(item.N)
			e, errE := base64.RawURLEncoding.DecodeString(item.E)
			if errN != nil || errE != nil {
				continue
			}
			keys[item.Kid] = &rsa.PublicKey{
				N: new(big.Int).SetBytes(n),
				E: int(new(big.Int).SetBytes(e).Int64()),
			}
		}
	}
	v.mu.Lock()
	v.keys = keys
	v.fetchedAt = time.Now()
	v.mu.Unlock()
	return nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
