"""Tests for the warranty string parser used by the migration."""
import pytest

from app.quotation.warranty_parser import parse_warranty


# --- Known-good month suffixes ---

@pytest.mark.parametrize("raw,expected_count", [
    ("3th", 3), ("6th", 6), ("12th", 12), ("24th", 24), ("36th", 36),
    ("1Th", 1), ("1th", 1), ("1 Th", 1),
    ("3 tháng", 3), ("6 tháng", 6),
    ("6m", 6), ("6 months", 6), ("6 month", 6),
    ("3 thang", 3),
])
def test_parser_month_variants(raw, expected_count):
    count, unit, reason = parse_warranty(raw)
    assert count == expected_count
    assert unit == "month"
    assert reason is None


# --- Known-good week suffixes ---

@pytest.mark.parametrize("raw,expected_count", [
    ("1 Tuan", 1), ("1tuan", 1), ("2 Tuan", 2),
    ("1 tuần", 1), ("2 tuần", 2),
    ("2w", 2), ("2 weeks", 2), ("2 week", 2), ("2 wk", 2),
])
def test_parser_week_variants(raw, expected_count):
    count, unit, reason = parse_warranty(raw)
    assert count == expected_count
    assert unit == "week"
    assert reason is None


# --- Bare number defaults to month ---

def test_parser_bare_number_defaults_to_month():
    count, unit, reason = parse_warranty("6")
    assert count == 6
    assert unit == "month"
    assert reason is None


# --- Empty / NULL is expected, no log ---

@pytest.mark.parametrize("raw", [None, "", "   "])
def test_parser_empty_no_log(raw):
    count, unit, reason = parse_warranty(raw)
    assert count is None
    assert unit is None
    assert reason is None


# --- Unparseable values: NULL with log reason ---

@pytest.mark.parametrize("raw", ["no warranty", "?", "abc"])
def test_parser_no_match_logged(raw):
    count, unit, reason = parse_warranty(raw)
    assert count is None
    assert unit is None
    assert reason is not None


def test_parser_unknown_suffix_logged():
    count, unit, reason = parse_warranty("3xy")
    assert count is None and unit is None
    assert reason == "unknown_suffix"


@pytest.mark.parametrize("raw", ["0th", "100th", "999th"])
def test_parser_count_out_of_range_logged(raw):
    count, unit, reason = parse_warranty(raw)
    assert count is None and unit is None
    assert reason == "count_out_of_range"
