from app.note.service import get_note, update_note


def test_get_note_creates_empty_row_on_first_access(db_session):
    note = get_note(db_session)
    assert note.id == 1
    assert note.content is None


def test_get_note_returns_same_single_row(db_session):
    first = get_note(db_session)
    second = get_note(db_session)
    assert first.id == second.id == 1


def test_update_note_persists_content(db_session):
    update_note(db_session, "hello world")
    note = get_note(db_session)
    assert note.content == "hello world"


def test_update_note_overwrites_existing_content(db_session):
    update_note(db_session, "first")
    update_note(db_session, "second")
    note = get_note(db_session)
    assert note.content == "second"


def test_update_note_allows_clearing_content(db_session):
    update_note(db_session, "something")
    update_note(db_session, None)
    note = get_note(db_session)
    assert note.content is None
