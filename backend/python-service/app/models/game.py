from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class GameQuestion(Base):
    __tablename__ = "game_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_url: Mapped[str] = mapped_column(Text, default="")
    content_type: Mapped[str] = mapped_column(String(32), default="image")
    answer: Mapped[str] = mapped_column(String(255), nullable=False)
    timer_seconds: Mapped[int] = mapped_column(Integer, default=60)
    points: Mapped[int] = mapped_column(Integer, default=10)
    break_after_win_seconds: Mapped[int] = mapped_column(Integer, default=5)
    hint: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class PhonebookEntry(Base):
    __tablename__ = "phonebook_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    player_name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class GameRound(Base):
    __tablename__ = "game_rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("game_questions.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    winner_phone: Mapped[str | None] = mapped_column(String(32))
    winner_name: Mapped[str | None] = mapped_column(String(128))
    awarded_points: Mapped[int | None] = mapped_column(Integer)

    question: Mapped[GameQuestion] = relationship()
    submissions: Mapped[list["SmsSubmission"]] = relationship(back_populates="round")


class SmsSubmission(Base):
    __tablename__ = "sms_submissions"
    __table_args__ = (Index("ix_sms_submissions_round_phone_created_at", "round_id", "phone", "created_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("game_rounds.id"), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    player_name: Mapped[str] = mapped_column(String(128), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    round: Mapped[GameRound] = relationship(back_populates="submissions")
