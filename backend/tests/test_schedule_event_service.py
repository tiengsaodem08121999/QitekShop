from datetime import date, time

import pytest

from app.schedule.models import EventStatus
from app.schedule.schemas import EventCreate, TagCreate
from app.schedule.service import (
    create_event, create_tag, delete_event, get_event, list_events,
    update_event, update_event_status,
)


def _ev(**overrides):
    base = dict(
        title="Pick up RAM",
        date=date(2026, 5, 4),
        start_time=time(18, 0),
        end_time=time(19, 0),
    )
    base.update(overrides)
    return EventCreate(**base)


def test_create_event(db_session, admin_user):
    ev = create_event(db_session, _ev(), admin_user.id)
    assert ev.id is not None
    assert ev.created_by == admin_user.id
    assert ev.is_deleted is False
    assert ev.status == EventStatus.pending


def test_create_event_with_tags(db_session, admin_user):
    tag1 = create_tag(db_session, TagCreate(name="pickup", color="#FF5733"))
    tag2 = create_tag(db_session, TagCreate(name="urgent", color="#FF0000"))
    ev = create_event(db_session, _ev(tag_ids=[tag1.id, tag2.id]), admin_user.id)
    assert {t.id for t in ev.tags} == {tag1.id, tag2.id}


def test_create_event_unknown_tag_raises(db_session, admin_user):
    with pytest.raises(ValueError):
        create_event(db_session, _ev(tag_ids=[999]), admin_user.id)


def test_list_events_within_range(db_session, admin_user):
    create_event(db_session, _ev(date=date(2026, 5, 1)), admin_user.id)
    create_event(db_session, _ev(date=date(2026, 5, 4)), admin_user.id)
    create_event(db_session, _ev(date=date(2026, 6, 1)), admin_user.id)

    items = list_events(db_session, date(2026, 5, 1), date(2026, 5, 31))
    assert len(items) == 2


def test_list_events_excludes_soft_deleted(db_session, admin_user):
    ev = create_event(db_session, _ev(), admin_user.id)
    delete_event(db_session, ev.id)
    items = list_events(db_session, date(2026, 5, 4), date(2026, 5, 4))
    assert items == []


def test_list_events_filter_by_status(db_session, admin_user):
    e1 = create_event(db_session, _ev(start_time=time(8, 0), end_time=time(9, 0)), admin_user.id)
    create_event(db_session, _ev(start_time=time(10, 0), end_time=time(11, 0)), admin_user.id)
    update_event_status(db_session, e1.id, EventStatus.done)

    items = list_events(db_session, date(2026, 5, 4), date(2026, 5, 4), status=EventStatus.done)
    assert len(items) == 1
    assert items[0].id == e1.id


def test_list_events_filter_by_tag(db_session, admin_user):
    tag = create_tag(db_session, TagCreate(name="pickup", color="#FF5733"))
    e1 = create_event(db_session, _ev(start_time=time(8, 0), end_time=time(9, 0), tag_ids=[tag.id]), admin_user.id)
    create_event(db_session, _ev(start_time=time(10, 0), end_time=time(11, 0)), admin_user.id)

    items = list_events(db_session, date(2026, 5, 4), date(2026, 5, 4), tag_id=tag.id)
    assert len(items) == 1
    assert items[0].id == e1.id


def test_list_events_orders_by_date_then_start(db_session, admin_user):
    later = create_event(db_session, _ev(start_time=time(20, 0), end_time=time(21, 0)), admin_user.id)
    earlier = create_event(db_session, _ev(start_time=time(8, 0), end_time=time(9, 0)), admin_user.id)
    items = list_events(db_session, date(2026, 5, 4), date(2026, 5, 4))
    assert [i.id for i in items] == [earlier.id, later.id]


def test_update_event_replaces_tags(db_session, admin_user):
    tag1 = create_tag(db_session, TagCreate(name="a", color="#000000"))
    tag2 = create_tag(db_session, TagCreate(name="b", color="#FFFFFF"))
    ev = create_event(db_session, _ev(tag_ids=[tag1.id]), admin_user.id)

    updated = update_event(db_session, ev.id, _ev(title="New title", tag_ids=[tag2.id]))
    assert updated.title == "New title"
    assert {t.id for t in updated.tags} == {tag2.id}


def test_update_event_status(db_session, admin_user):
    ev = create_event(db_session, _ev(), admin_user.id)
    updated = update_event_status(db_session, ev.id, EventStatus.in_progress)
    assert updated.status == EventStatus.in_progress


def test_soft_delete_event(db_session, admin_user):
    ev = create_event(db_session, _ev(), admin_user.id)
    assert delete_event(db_session, ev.id) is True
    fresh = get_event(db_session, ev.id)
    assert fresh is None


def test_update_missing_event_returns_none(db_session):
    assert update_event(db_session, 999, _ev()) is None
    assert update_event_status(db_session, 999, EventStatus.done) is None
    assert delete_event(db_session, 999) is False


def test_create_event_overlapping_raises(db_session, admin_user):
    create_event(db_session, _ev(start_time=time(18, 0), end_time=time(19, 0)), admin_user.id)
    with pytest.raises(ValueError, match="Time conflict"):
        create_event(db_session, _ev(start_time=time(18, 30), end_time=time(19, 30)), admin_user.id)


def test_create_event_adjacent_range_allowed(db_session, admin_user):
    create_event(db_session, _ev(start_time=time(18, 0), end_time=time(19, 0)), admin_user.id)
    # Touching (19:00 = 19:00) is allowed
    create_event(db_session, _ev(start_time=time(19, 0), end_time=time(20, 0)), admin_user.id)


def test_create_event_different_day_allowed(db_session, admin_user):
    create_event(db_session, _ev(date=date(2026, 5, 4)), admin_user.id)
    create_event(db_session, _ev(date=date(2026, 5, 5)), admin_user.id)


def test_cancelled_event_does_not_block(db_session, admin_user):
    e1 = create_event(db_session, _ev(), admin_user.id)
    update_event_status(db_session, e1.id, EventStatus.cancelled)
    create_event(db_session, _ev(), admin_user.id)


def test_update_event_keeping_same_slot_allowed(db_session, admin_user):
    ev = create_event(db_session, _ev(), admin_user.id)
    updated = update_event(db_session, ev.id, _ev(title="renamed"))
    assert updated.title == "renamed"


def test_update_event_to_overlap_others_raises(db_session, admin_user):
    create_event(db_session, _ev(start_time=time(18, 0), end_time=time(19, 0)), admin_user.id)
    e2 = create_event(db_session, _ev(start_time=time(20, 0), end_time=time(21, 0)), admin_user.id)
    with pytest.raises(ValueError, match="Time conflict"):
        update_event(db_session, e2.id, _ev(start_time=time(18, 30), end_time=time(19, 30)))
