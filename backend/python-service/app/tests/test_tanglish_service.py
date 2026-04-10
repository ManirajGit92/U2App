from app.schemas.tanglish import ConvertRequest
from app.services.tanglish_service import tanglish_service


def test_convert_phrase_and_words() -> None:
    result = tanglish_service.convert(ConvertRequest(text="Thank you very much", preserve_unknown_words=True))
    assert result.tanglish_text == "romba nandri"
    assert "phrase:thank you very much" in result.applied_rules


def test_pattern_translation() -> None:
    result = tanglish_service.convert(ConvertRequest(text="Can you help"))
    assert result.tanglish_text.endswith("panna mudiyuma?")
