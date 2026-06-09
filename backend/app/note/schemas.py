from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NoteUpdate(BaseModel):
    content: Optional[str] = None


class NoteResponse(BaseModel):
    model_config = {"from_attributes": True}

    content: Optional[str]
    updated_at: Optional[datetime]
