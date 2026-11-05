import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-internal-token")
os.environ.setdefault("LLM_PROVIDER", "mock")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "600")
os.environ.setdefault("LLM_MAX_RETRIES", "1")

import pytest


@pytest.fixture
def goal_payload() -> dict:
    return {
        "title": "AI Engineering from zero",
        "goal_statement": "I want to learn AI engineering from zero and build agents that use tools.",
        "intended_outcome": "Build and evaluate a small tool-using agent.",
        "motivation": "I want to automate repetitive research tasks.",
        "additional_context": "I know some Python basics.",
        "self_reported_level": "basic",
        "current_knowledge": {
            "prior_experience": "Small Python scripts",
            "known_topics": "Variables, loops, functions",
            "difficult_topics": "APIs and async programming",
        },
        "weekly_study_minutes": 300,
        "learning_language": "en-US",
        "learning_preferences": {
            "learning_style": "hands-on",
            "theory_practice_balance": 30,
            "project_oriented": True,
        },
        "target_date": None,
    }


@pytest.fixture
def diagnostic_payload(goal_payload: dict) -> dict:
    return {
        "estimated_level": "beginner",
        "confidence": "medium",
        "summary": "You know some Python but need practice with APIs and async work.",
        "strengths": [
            {"competency": "Python basics", "evidence": "Can write small scripts."}
        ],
        "gaps": [
            {
                "competency": "APIs",
                "description": "Limited experience calling and handling APIs.",
                "severity": "medium",
                "recommendation": "Start with one guided API exercise.",
            }
        ],
        "recommended_start": "Begin with a short foundations module.",
        "rationale": "You have enough Python to start applied work but need API fundamentals.",
    }
