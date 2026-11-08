from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.core.errors import ContentValidationError
from app.prompts.learner import render_tutor_guidance
from app.providers.base import ProviderResult
from app.schemas.learner import InsightsRequest, TutorGuidance
from app.services.learner_service import generate_insights

SETTINGS = SimpleNamespace(llm_max_output_tokens=2000, llm_max_output_bytes=100_000, llm_temperature=0.2, llm_timeout_seconds=30)


def request() -> InsightsRequest:
    return InsightsRequest.model_validate(
        {
            "preferences": {"explanation_style": "simple"},
            "evidence": [
                {
                    "competency": "Derivatives",
                    "status": "learning",
                    "attempts": 3,
                    "estimated_mastery": 0.3,
                    "mistakes": ["chain rule"],
                    "events": [
                        {"id": "ev-1", "event_type": "exercise_submitted", "score": 0.2, "at": "2026-10-01T09:00:00Z"},
                        {"id": "ev-2", "event_type": "exercise_submitted", "score": 0.3, "at": "2026-10-02T09:00:00Z"},
                    ],
                }
            ],
        }
    )


class FakeProvider:
    name = "fake"
    model = "fake-1"

    def __init__(self, *responses: dict):
        self.responses = list(responses)
        self.calls = 0

    async def generate_json(self, req):
        self.calls += 1
        data = self.responses.pop(0)
        return ProviderResult(data=data, provider=self.name, model=self.model, duration_ms=1)


GOOD = {"insights": [{"kind": "pattern", "statement": "Chain rule mistakes repeat in recent exercises.", "rationale": "Two exercises were tagged with the same mistake.", "evidence_event_ids": ["ev-1", "ev-2"], "confidence": "medium"}]}


def run(coro):
    return asyncio.run(coro)


def test_valid_insights_pass_through():
    provider = FakeProvider(GOOD)
    result = run(generate_insights(request(), provider=provider, settings=SETTINGS))
    assert len(result.insights) == 1 and provider.calls == 1
    assert result.insights[0].evidence_event_ids == ["ev-1", "ev-2"]


def test_invented_event_id_triggers_repair_then_succeeds():
    bad = {"insights": [{**GOOD["insights"][0], "evidence_event_ids": ["ev-999"]}]}
    provider = FakeProvider(bad, GOOD)
    result = run(generate_insights(request(), provider=provider, settings=SETTINGS))
    assert provider.calls == 2 and result.metadata["repaired"] is True


def test_invalid_json_shape_fails_safely_after_one_repair():
    provider = FakeProvider({"insights": "nope"}, {"insights": [{"kind": "weakness"}]})
    with pytest.raises(ContentValidationError):
        run(generate_insights(request(), provider=provider, settings=SETTINGS))
    assert provider.calls == 2


def test_psychological_claims_are_rejected():
    bad = {"insights": [{**GOOD["insights"][0], "statement": "You are not very intelligent about maths."}]}
    provider = FakeProvider(bad, bad)
    with pytest.raises(ContentValidationError):
        run(generate_insights(request(), provider=provider, settings=SETTINGS))


def test_extra_fields_are_rejected():
    extra = {"insights": [{**GOOD["insights"][0], "mastery": 0.9}]}
    provider = FakeProvider(extra, extra)
    with pytest.raises(ContentValidationError):
        run(generate_insights(request(), provider=provider, settings=SETTINGS))


def guidance(approach: str, **over) -> TutorGuidance:
    base = {"approach": approach, "focus": "Gradient descent", "reasons": [], "strengths": [], "review_first": [], "avoid_repeating": [], "certainty": "medium", "style": {"explanation": "simple", "examples": "practical", "pace": "steady", "language": "en-US"}}
    base.update(over)
    return TutorGuidance.model_validate(base)


def test_guidance_differs_by_learner_history():
    a = render_tutor_guidance(guidance("prerequisite_first", review_first=["Derivatives"]))
    b = render_tutor_guidance(guidance("challenge", avoid_repeating=["Derivatives"]))
    assert a != b and "Revisit first: Derivatives" in a and "skip the basics" in b


def test_guidance_never_exposes_scores_or_shames():
    text = render_tutor_guidance(guidance("worked_examples", certainty="low"))
    assert not any(ch.isdigit() for ch in text.replace("Phase", ""))
    assert "Never mention scores" in text and "tentative" in text
    assert "weak" in text  # only inside the instruction not to use the word
    assert "label the learner as weak" in text
