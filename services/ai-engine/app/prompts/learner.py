from __future__ import annotations

import json
from typing import Any

from app.schemas.learner import TutorGuidance

PROMPT_VERSION = "phase04.v1"

INSIGHTS_SYSTEM = """You analyse a learner's recorded learning evidence for an education product.
Rules you must follow:
- Use ONLY the evidence provided. Never invent scores, events or history.
- Every insight must cite evidence_event_ids copied exactly from the events provided.
- Describe what the evidence shows about specific competencies. Do not make claims about the
  person: no statements about intelligence, personality, motivation, mental health, ability
  labels or learning disorders.
- Be encouraging and specific. Never shame. Prefer "recent attempts show ..." to "you are bad at ...".
- Separate what was observed from what is only suggested; use low confidence when evidence is thin
  (fewer than 3 attempts).
- You do not decide grades, mastery or unlocks. Do not output them.
- Return one JSON object that matches the schema. No prose outside the JSON."""


def build_insights_prompt(payload: dict[str, Any], schema: dict[str, Any]) -> tuple[str, str]:
    user = (
        "Learner preferences and evidence digest (JSON):\n"
        + json.dumps(payload, ensure_ascii=False)
        + "\n\nProduce up to 5 insights. kind must be one of strength, pattern, misconception, strategy.\n"
        + "JSON schema:\n"
        + json.dumps(schema, ensure_ascii=False)
    )
    return INSIGHTS_SYSTEM, user


_APPROACH_TEXT = {
    "retrieval_review": "The learner did well on this earlier but missed a recent retention check. Start with a short retrieval question, then re-explain only what they miss.",
    "prerequisite_first": "Difficulty here appears linked to an earlier foundation. Briefly revisit the prerequisite listed below in simple words, with one concrete example, then return to the topic.",
    "worked_examples": "Prefer concrete worked examples and step-by-step solutions over abstract explanation. Then give a guided exercise and gradually reduce help.",
    "challenge": "Recent work is consistently strong. Skip beginner framing; offer an applied scenario or harder problem.",
    "standard": "Teach normally: explain, demonstrate, practise, check understanding.",
}

_STYLE_TEXT = {
    "simple": "plain language, minimal jargon",
    "balanced": "clear explanations with some technical terms defined",
    "technical": "precise technical language",
}


def render_tutor_guidance(guidance: TutorGuidance) -> str:
    """Render guidance for the tutor's system prompt.

    The block never contains numeric scores. It separates observed facts (strengths, review
    items) from estimates (certainty) and tells the tutor not to dwell on weaknesses.
    """

    lines = [
        "LEARNER CONTEXT (use quietly; do not recite it back to the learner):",
        f"- Topic in focus: {guidance.focus}",
        f"- Suggested approach: {_APPROACH_TEXT[guidance.approach]}",
        f"- Explanation style requested by the learner: {_STYLE_TEXT.get(guidance.style.get('explanation', 'balanced'), 'clear')}; "
        f"examples: {guidance.style.get('examples', 'mixed')}; pace: {guidance.style.get('pace', 'steady')}.",
    ]
    if guidance.review_first:
        lines.append("- Revisit first: " + ", ".join(guidance.review_first))
    if guidance.strengths:
        lines.append("- Topics the learner has shown solid understanding of (do not re-teach): " + ", ".join(guidance.strengths))
    if guidance.avoid_repeating:
        lines.append("- Already mastered, skip the basics: " + ", ".join(guidance.avoid_repeating))
    if guidance.certainty == "low":
        lines.append("- Evidence about this learner is limited. Treat the above as tentative and check understanding before assuming.")
    lines += [
        "- Never mention scores, never label the learner as weak, and never discourage. Frame difficulty as a normal part of learning.",
        "- If the learner asks for a different explanation style, switch immediately and follow the request.",
    ]
    return "\n".join(lines)
