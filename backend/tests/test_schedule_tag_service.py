import pytest

from app.schedule.schemas import TagCreate, TagUpdate
from app.schedule.service import (
    create_tag, delete_tag, get_tag, list_tags, update_tag,
)


def test_create_tag(db_session):
    tag = create_tag(db_session, TagCreate(name="pickup", color="#FF5733"))
    assert tag.id is not None
    assert tag.name == "pickup"
    assert tag.color == "#FF5733"


def test_create_tag_duplicate_name_raises(db_session):
    create_tag(db_session, TagCreate(name="pickup", color="#FF5733"))
    with pytest.raises(Exception):
        create_tag(db_session, TagCreate(name="pickup", color="#000000"))


def test_list_tags(db_session):
    create_tag(db_session, TagCreate(name="pickup", color="#FF5733"))
    create_tag(db_session, TagCreate(name="delivery", color="#33C1FF"))
    tags = list_tags(db_session)
    assert len(tags) == 2
    assert {t.name for t in tags} == {"pickup", "delivery"}


def test_update_tag(db_session):
    tag = create_tag(db_session, TagCreate(name="pickup", color="#FF5733"))
    updated = update_tag(db_session, tag.id, TagUpdate(name="pick-up", color="#000000"))
    assert updated is not None
    assert updated.name == "pick-up"
    assert updated.color == "#000000"


def test_update_tag_missing_returns_none(db_session):
    assert update_tag(db_session, 999, TagUpdate(name="x", color="#000000")) is None


def test_delete_tag(db_session):
    tag = create_tag(db_session, TagCreate(name="pickup", color="#FF5733"))
    assert delete_tag(db_session, tag.id) is True
    assert get_tag(db_session, tag.id) is None


def test_delete_tag_missing_returns_false(db_session):
    assert delete_tag(db_session, 999) is False
