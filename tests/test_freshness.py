from datetime import datetime, timedelta, timezone

from neonfeed.freshness import ContentItem, assess_batch, calculate_freshness


def test_calculate_freshness_recent_content():
    item = ContentItem(
        title="Recent article",
        body="This is a detailed update with roadmap and changelog notes",
        last_updated=datetime.now(timezone.utc) - timedelta(days=5),
    )

    result = calculate_freshness(item)

    assert result.freshness_score >= 0.8
    assert result.action.startswith("Evergreen")
    assert result.days_since_update == 5


def test_calculate_freshness_old_short_content():
    item = ContentItem(
        title="Old note",
        body="Short blurb",
        last_updated=datetime.now(timezone.utc) - timedelta(days=300),
    )

    result = calculate_freshness(item)

    assert result.freshness_score < 0.6
    assert "Refresh soon" in result.action
    assert "short" in result.summary.lower()


def test_assess_batch_handles_missing_dates():
    item = ContentItem(title="Unknown date", body="Long enough body" * 60, last_updated=None)

    results = assess_batch([item])

    assert len(results) == 1
    assert results[0].days_since_update is None
    assert "No update date provided" in results[0].summary
