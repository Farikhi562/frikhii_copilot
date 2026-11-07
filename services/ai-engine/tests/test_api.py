from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEADERS = {"X-Internal-Token": "test-internal-token"}
BAD_HEADERS = {"X-Internal-Token": "wrong"}


def test_health_is_public_and_does_not_expose_secrets():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "api_key" not in str(body).lower()


def test_internal_endpoint_requires_token(goal_payload):
    response = client.post(
        "/internal/v1/diagnostic/generate",
        json={"learning_goal": goal_payload},
    )
    assert response.status_code == 401


def test_internal_endpoint_rejects_wrong_token(goal_payload):
    response = client.post(
        "/internal/v1/diagnostic/generate",
        json={"learning_goal": goal_payload},
        headers=BAD_HEADERS,
    )
    assert response.status_code == 401


def test_generate_diagnostic_over_http(goal_payload):
    response = client.post(
        "/internal/v1/diagnostic/generate",
        json={"learning_goal": goal_payload, "question_count": 6},
        headers=HEADERS,
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["question_set"]["questions"]) == 6
    assert body["metadata"]["provider"] == "mock"
    assert body["metadata"]["generated_at"]


def test_generate_curriculum_over_http(goal_payload, diagnostic_payload):
    response = client.post(
        "/internal/v1/course/generate",
        json={"learning_goal": goal_payload, "diagnostic": diagnostic_payload},
        headers=HEADERS,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["course"]["modules"]
    assert body["metadata"]["provider"] == "mock"


def test_invalid_request_is_rejected(goal_payload):
    response = client.post(
        "/internal/v1/course/generate",
        json={"learning_goal": goal_payload},
        headers=HEADERS,
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
