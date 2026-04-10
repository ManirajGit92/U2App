from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import GameQuestion, PhonebookEntry
from app.schemas.game import PhonebookUpsert, QuestionConfig


class GameRepository:
    def __init__(self, session: Session):
        self.session = session

    def replace_questions(self, questions: Iterable[QuestionConfig]) -> None:
        self.session.query(GameQuestion).delete()
        for item in questions:
            self.session.add(
                GameQuestion(
                    question_number=item.no,
                    content_url=item.content_url,
                    content_type=item.content_type,
                    answer=item.answer,
                    timer_seconds=item.timer,
                    points=item.points,
                    break_after_win_seconds=item.break_after_win,
                    hint=item.hint,
                )
            )
        self.session.commit()

    def upsert_phonebook_entry(self, payload: PhonebookUpsert) -> None:
        entity = self.session.query(PhonebookEntry).filter_by(phone=payload.phone).one_or_none()
        if entity is None:
            entity = PhonebookEntry(phone=payload.phone, player_name=payload.name)
            self.session.add(entity)
        else:
            entity.player_name = payload.name
        self.session.commit()
