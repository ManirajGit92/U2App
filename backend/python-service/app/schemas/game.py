from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class QuestionConfig(BaseModel):
    no: int
    content_url: str = Field(default="", alias="contentUrl")
    content_type: str = Field(default="image", alias="contentType")
    answer: str
    timer: int = 60
    points: int = 10
    break_after_win: int = Field(default=5, alias="breakAfterWin")
    hint: str = ""

    model_config = {"populate_by_name": True}


class PhonebookUpsert(BaseModel):
    phone: str = Field(min_length=3)
    name: str = Field(min_length=1)


class GameControlRequest(BaseModel):
    action: Literal["start", "next", "pause", "resume", "reset"]
    skip_break: bool = Field(default=False, alias="skipBreak")

    model_config = {"populate_by_name": True}


class SmsMessageRequest(BaseModel):
    phone: str = Field(min_length=3)
    message: str = Field(min_length=1)


class SmsLogEntry(BaseModel):
    phone: str
    name: str
    message: str
    time: datetime
    correct: bool


class WinnerSchema(BaseModel):
    name: str
    phone: str
    points: int
    message: str


class PublicQuestion(BaseModel):
    no: int
    content_url: str = Field(alias="contentUrl")
    content_type: str = Field(alias="contentType")
    answer: str | None = None
    timer: int
    points: int
    break_after_win: int = Field(alias="breakAfterWin")
    hint: str

    model_config = {"populate_by_name": True}


class GameStateResponse(BaseModel):
    status: str
    current_index: int = Field(alias="currentIndex")
    total_questions: int = Field(alias="totalQuestions")
    current_question: PublicQuestion | None = Field(alias="currentQuestion")
    timer_remaining: int = Field(alias="timerRemaining")
    break_remaining: int = Field(alias="breakRemaining")
    scores: dict[str, int]
    sms_log: list[SmsLogEntry] = Field(alias="smsLog")
    winner: WinnerSchema | None

    model_config = {"populate_by_name": True}


class ConfigLoadResponse(BaseModel):
    ok: bool
    questions: int
    players: int
