from datetime import date, time

import pytest
from pydantic import ValidationError

from app.schedule.schemas import EventCreate
from app.schedule.models import EventStatus


def test_event_create_minimum_valid():
    ev = EventCreate(
        title="Pick up RAM",
        date=date(2026, 5, 4),
        start_time=time(18, 0),
        end_time=time(19, 0),
    )
    assert ev.status == EventStatus.pending
    assert ev.tag_ids == []
    assert ev.description is None


def test_event_create_end_before_start_rejected():
    with pytest.raises(ValidationError):
        EventCreate(
            title="x",
            date=date(2026, 5, 4),
            start_time=time(20, 0),
            end_time=time(18, 0),
        )


def test_event_create_end_equal_start_rejected():
    with pytest.raises(ValidationError):
        EventCreate(
            title="x",
            date=date(2026, 5, 4),
            start_time=time(18, 0),
            end_time=time(18, 0),
        )


def test_event_create_with_tags_and_description():
    ev = EventCreate(
        title="Pick up main chip",
        date=date(2026, 5, 4),
        start_time=time(20, 0),
        end_time=time(21, 0),
        description="Address: 123 Le Loi",
        tag_ids=[1, 2],
    )
    assert ev.tag_ids == [1, 2]
    assert ev.description == "Address: 123 Le Loi"
