"""Minimal HTTP server for the neonfeed freshness scorer."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, Optional

from neonfeed.freshness import ContentItem, assess_batch


class FreshnessService:
    def score_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        items = payload.get("items")
        if not isinstance(items, list):
            raise ValueError("Payload must include an 'items' list")

        content_items = [self._parse_item(item) for item in items]
        assessments = assess_batch(content_items)

        return {
            "results": [
                {
                    "title": assessment.title,
                    "freshness_score": assessment.freshness_score,
                    "days_since_update": assessment.days_since_update,
                    "action": assessment.action,
                    "summary": assessment.summary,
                }
                for assessment in assessments
            ]
        }

    @staticmethod
    def _parse_item(item: Dict[str, Any]) -> ContentItem:
        if not isinstance(item, dict):
            raise ValueError("Each item must be an object")

        try:
            title = item["title"]
            body = item["body"]
        except KeyError as exc:
            raise ValueError("Each item requires 'title' and 'body'") from exc

        last_updated = FreshnessService._parse_datetime(item.get("last_updated"))
        return ContentItem(title=title, body=body, last_updated=last_updated)

    @staticmethod
    def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
        if value in (None, ""):
            return None
        # Support trailing Z suffix
        if isinstance(value, str) and value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value).astimezone(timezone.utc)


class FreshnessHandler(BaseHTTPRequestHandler):
    service = FreshnessService()

    def _send_json(self, status: int, payload: Dict[str, Any]):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            self._send_json(200, {"status": "ok"})
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):  # noqa: N802
        if self.path != "/freshness":
            self._send_json(404, {"error": "Not Found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length)

        try:
            payload = json.loads(raw_body or "{}")
            response = self.service.score_payload(payload)
            self._send_json(200, response)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON"})


def run_server(host: str = "0.0.0.0", port: int = 8000):
    server = HTTPServer((host, port), FreshnessHandler)
    print(f"Serving on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run_server()
