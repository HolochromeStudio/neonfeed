# neonfeed

A lightweight micro SaaS starter focused on **content freshness**. The service scores
articles, release notes, or docs so you know what to refresh next.

## Features
- HTTP endpoint `/freshness` that accepts one or more content items and returns
  actionable freshness scores.
- Opinionated scoring that blends recency, length, and update-related keywords.
- Clear recommendations like _Evergreen_, _Monitor_, or _Refresh soon_.
- Python helpers to reuse the scoring logic outside the API.

## Getting started
1. Install dependencies (Python 3.11+ recommended):
   ```bash
   pip install -r requirements.txt
   ```
2. Run the API locally (standard library only):
   ```bash
   python -m app.main
   ```
3. Call the freshness endpoint:
   ```bash
   curl -X POST http://localhost:8000/freshness \
     -H "Content-Type: application/json" \
     -d '{
       "items": [
         {
           "title": "Q1 Roadmap",
           "body": "We shipped version 1.2 with a new changelog for 2024.",
           "last_updated": "2024-06-01T12:00:00Z"
         }
       ]
     }'
   ```

## Development
- Run tests:
  ```bash
  pytest
  ```
- The scoring logic lives in `neonfeed/freshness.py` and is covered by unit and
  API-level tests in `tests/`.
