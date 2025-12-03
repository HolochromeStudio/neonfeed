import json
from http.client import HTTPConnection
from http.server import HTTPServer
from threading import Thread
from time import sleep

from app.main import FreshnessHandler, FreshnessService


def _start_server(port: int = 8765):
    server = HTTPServer(("127.0.0.1", port), FreshnessHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    sleep(0.05)
    return server, thread


def test_score_payload_orders_scores():
    service = FreshnessService()
    payload = {
        "items": [
            {
                "title": "Fresh doc",
                "body": "Recent roadmap update with changelog",
                "last_updated": "2024-06-01T12:00:00Z",
            },
            {
                "title": "Old note",
                "body": "Legacy post without updates",
                "last_updated": "2022-01-01T00:00:00Z",
            },
        ]
    }

    response = service.score_payload(payload)

    assert len(response["results"]) == 2
    scores = [item["freshness_score"] for item in response["results"]]
    assert scores[0] > scores[1]
    assert response["results"][0]["action"].startswith("Evergreen")


def test_http_server_handles_health_and_freshness():
    server, thread = _start_server()
    conn = HTTPConnection("127.0.0.1", 8765)

    try:
        conn.request("GET", "/health")
        health = conn.getresponse()
        assert health.status == 200
        assert json.loads(health.read()) == {"status": "ok"}

        payload = json.dumps(
            {
                "items": [
                    {
                        "title": "Docs",
                        "body": "We added a new changelog for 2024 releases.",
                        "last_updated": "2024-06-15T00:00:00Z",
                    }
                ]
            }
        )
        conn.request(
            "POST",
            "/freshness",
            body=payload,
            headers={"Content-Type": "application/json"},
        )
        response = conn.getresponse()
        assert response.status == 200
        data = json.loads(response.read())
        assert data["results"][0]["freshness_score"] >= 0.6
    finally:
        server.shutdown()
        thread.join(timeout=1)
