package aiclient

import (
	"context"

	"github.com/frikhii/copilot/core-api/internal/intelligence"
)

type insightsRequest struct {
	Preferences intelligence.Preferences      `json:"preferences"`
	Evidence    []intelligence.EvidenceDigest `json:"evidence"`
	RequestID   string                        `json:"request_id,omitempty"`
}

type insightsResponse struct {
	Insights []intelligence.AIInsight `json:"insights"`
}

// IntelligenceAnalyzer adapts Client to intelligence.Analyzer. The response is untrusted;
// intelligence.Service validates it against real event ids before storing anything.
type IntelligenceAnalyzer struct{ Client *Client }

func (a IntelligenceAnalyzer) Analyze(ctx context.Context, digest []intelligence.EvidenceDigest, prefs intelligence.Preferences) ([]intelligence.AIInsight, error) {
	var out insightsResponse
	if err := a.Client.post(ctx, "/internal/v1/learner/insights", insightsRequest{Preferences: prefs, Evidence: digest}, &out); err != nil {
		return nil, err
	}
	return out.Insights, nil
}
