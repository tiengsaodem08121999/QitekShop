from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    # LONGTEXT on MySQL so base64-encoded shop logos (multiple MB) fit; plain
    # TEXT (64KB) is too small. Falls back to TEXT on other dialects (SQLite tests).
    value: Mapped[Optional[str]] = mapped_column(
        Text().with_variant(LONGTEXT(), "mysql"), nullable=True
    )
