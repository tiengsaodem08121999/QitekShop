import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.models import User, UserRole
from app.auth.service import create_access_token
from app.database import Base, get_db
from app.main import app

# Import every model so Base.metadata sees them when create_all runs
from app.models import Setting  # noqa: F401
from app.quotation.models import Customer, Quotation, QuotationItem  # noqa: F401
from app.finance.models import Transaction  # noqa: F401


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db_session):
    def _override():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _make_user(db_session, username: str, role: UserRole) -> User:
    user = User(
        username=username,
        password_hash="x",
        full_name=username.title(),
        role=role,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    return _make_user(db_session, "admin1", UserRole.admin)


@pytest.fixture
def sales_user(db_session):
    return _make_user(db_session, "sales1", UserRole.sales)


@pytest.fixture
def accountant_user(db_session):
    return _make_user(db_session, "accountant1", UserRole.accountant)


def auth_headers(user: User) -> dict:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}
