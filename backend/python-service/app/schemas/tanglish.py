from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ConvertRequest(BaseModel):
    text: str = Field(min_length=1)
    engine: str = "rule-based"
    preserve_unknown_words: bool = Field(default=True, alias="preserveUnknownWords")

    model_config = {"populate_by_name": True}


class ConvertResponse(BaseModel):
    source_text: str = Field(alias="sourceText")
    tanglish_text: str = Field(alias="tanglishText")
    engine: str
    fully_matched: bool = Field(alias="fullyMatched")
    applied_rules: list[str] = Field(alias="appliedRules")
    note: str | None = None

    model_config = {"populate_by_name": True}


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1)
    voice: Literal[
        "alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova",
        "sage", "shimmer", "verse", "marin", "cedar",
    ] = "coral"
    speed: float = Field(default=1.0, ge=0.25, le=4.0)
    format: Literal["mp3", "opus", "aac", "flac", "wav", "pcm"] = "mp3"
    instructions: str | None = "Speak naturally in a warm Tanglish style with clear pronunciation."

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Text is required.")
        return stripped
