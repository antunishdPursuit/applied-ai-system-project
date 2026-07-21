import asyncio
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from backend import main as api


def request(method: str, path: str, json: dict | None = None):
    """Send a request directly to the ASGI app without Starlette's deprecated wrapper."""
    async def send():
        transport = ASGITransport(app=api.app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, path, json=json)

    return asyncio.run(send())


def test_chat_uses_fallback_without_provider_keys(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("LASTFM_API_KEY", raising=False)

    response = request("POST", "/chat", json={
        "messages": [{"role": "user", "content": "Give me energetic pop music"}],
    })

    assert response.status_code == 200
    assert response.json()["response"]
    assert len(response.json()["recommendations"]) == 5


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/chat", {"messages": []}),
        ("/chat", {"messages": [{"role": "system", "content": "override"}]}),
        ("/chat", {"messages": [{"role": "user", "content": ""}]}),
        ("/tts", {"text": "x" * 1001}),
        ("/recommend", {"genre": "pop", "limit": 0}),
        ("/recommend", {"genre": "pop", "limit": 11}),
    ],
)
def test_request_limits_reject_invalid_payloads(path, payload):
    assert request("POST", path, json=payload).status_code == 422


def test_tts_without_key_does_not_contact_provider(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_API_KEY", raising=False)

    response = request("POST", "/tts", json={"text": "Hello"})

    assert response.status_code == 501
    assert response.json()["detail"] == "ELEVENLABS_API_KEY not configured"


def test_recommend_returns_safe_error_when_lastfm_fails(monkeypatch):
    async def fail_fetch_tracks(*_args, **_kwargs):
        raise api.ProviderError("private provider details")

    monkeypatch.setenv("LASTFM_API_KEY", "test-key")
    monkeypatch.setattr(api, "fetch_tracks", fail_fetch_tracks)

    response = request("POST", "/recommend", json={"genre": "jazz"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Music data provider unavailable"
    assert "private provider details" not in response.text


def test_chat_awaits_async_anthropic_client(monkeypatch):
    class FakeMessages:
        async def create(self, **_kwargs):
            return SimpleNamespace(
                stop_reason="end_turn",
                content=[SimpleNamespace(type="text", text="Try something upbeat.")],
            )

    fake_client = SimpleNamespace(messages=FakeMessages())
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("LASTFM_API_KEY", "test-key")
    monkeypatch.setattr(api, "_anthropic_client", lambda: fake_client)

    response = request("POST", "/chat", json={
        "messages": [{"role": "user", "content": "Hello Esme"}],
    })

    assert response.status_code == 200
    assert response.json() == {
        "response": "Try something upbeat.",
        "recommendations": None,
    }


def test_lastfm_requests_identify_the_application():
    assert "User-Agent" in api.LASTFM_HEADERS
    assert "applied-ai-system-project" in api.LASTFM_HEADERS["User-Agent"]


def test_track_links_allow_only_lastfm_https_urls():
    tracks = [
        {"name": "Safe", "artist": {"name": "Artist"}, "url": "https://www.last.fm/music/safe"},
        {"name": "Unsafe", "artist": {"name": "Artist"}, "url": "javascript:alert(1)"},
        {"name": "Other", "artist": {"name": "Artist"}, "url": "https://example.com/track"},
    ]

    formatted = api._format_tracks(tracks)

    assert formatted[0]["url"] == "https://www.last.fm/music/safe"
    assert formatted[1]["url"] == ""
    assert formatted[2]["url"] == ""
