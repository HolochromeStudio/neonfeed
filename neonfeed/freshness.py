"""Content freshness scoring utilities for the neonfeed micro SaaS."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, List, Optional


@dataclass
class ContentItem:
    """Represents a piece of content to score."""

    title: str
    body: str
    last_updated: Optional[datetime] = None

    @property
    def word_count(self) -> int:
        return len(self.body.split())


@dataclass
class FreshnessAssessment:
    """Assessment output for a content item."""

    title: str
    freshness_score: float
    days_since_update: Optional[int]
    action: str
    summary: str


def _calculate_recency_score(last_updated: Optional[datetime]) -> tuple[float, Optional[int]]:
    if last_updated is None:
        return 0.5, None

    now = datetime.now(timezone.utc)
    delta = now - last_updated
    days = max(delta.days, 0)

    if days <= 30:
        recency = 1.0
    elif days <= 90:
        recency = 0.85
    elif days <= 180:
        recency = 0.75
    elif days <= 365:
        recency = 0.65
    elif days <= 730:
        recency = 0.75
    else:
        recency = 0.6

    return recency, days


def _calculate_length_score(word_count: int) -> float:
    if word_count <= 0:
        return 0.0

    normalized = min(word_count / 500, 1.0)
    return max(0.4, normalized)


def _has_update_keywords(body: str) -> float:
    keywords = ("update", "refresh", "2024", "roadmap", "changelog")
    body_lower = body.lower()
    return 1.0 if any(keyword in body_lower for keyword in keywords) else 0.3


def calculate_freshness(item: ContentItem) -> FreshnessAssessment:
    """Score content freshness and return actionable guidance."""

    recency_score, days = _calculate_recency_score(item.last_updated)
    length_score = _calculate_length_score(item.word_count)
    keyword_score = _has_update_keywords(item.body)

    weighted_score = (0.65 * recency_score) + (0.2 * length_score) + (0.15 * keyword_score)
    freshness_score = round(weighted_score, 2)

    if freshness_score >= 0.7:
        action = "Evergreen—spot check quarterly."
    elif freshness_score >= 0.6:
        action = "Monitor—review this month."
    else:
        action = "Refresh soon—prioritize an update."

    summary = _build_summary(item, freshness_score, days, length_score, keyword_score)
    return FreshnessAssessment(
        title=item.title,
        freshness_score=freshness_score,
        days_since_update=days,
        action=action,
        summary=summary,
    )


def _build_summary(
    item: ContentItem,
    freshness_score: float,
    days: Optional[int],
    length_score: float,
    keyword_score: float,
) -> str:
    parts: List[str] = [f"Score {freshness_score:.2f} for '{item.title}'."]
    if days is None:
        parts.append("No update date provided; assume partial staleness.")
    else:
        parts.append(f"Last touched {days} days ago.")

    if length_score < 0.6:
        parts.append("Content is short; expand with examples.")
    elif length_score > 0.9:
        parts.append("Content is long; consider a summary section.")

    if keyword_score < 0.5:
        parts.append("Add recent details or changelog notes for relevance.")

    return " ".join(parts)


def assess_batch(items: Iterable[ContentItem]) -> List[FreshnessAssessment]:
    return [calculate_freshness(item) for item in items]
