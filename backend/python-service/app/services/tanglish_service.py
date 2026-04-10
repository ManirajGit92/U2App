import re

from app.schemas.tanglish import ConvertRequest, ConvertResponse


PHRASE_MAP = {
    "how are you": "epdi irukka",
    "what are you doing": "enna panra",
    "where are you": "enga irukka",
    "see you later": "apparam paakalam",
    "thank you very much": "romba nandri",
    "thank you": "nandri",
    "good morning": "kalai vanakkam",
    "good evening": "maalai vanakkam",
    "good night": "iravu vanakkam",
    "excuse me": "konjam kelu",
    "please wait": "konjam wait pannunga",
    "come here": "inga vaa",
    "go there": "anga po",
    "i am fine": "naan nalla irukken",
    "take care": "paathukko",
    "well done": "super-aa pannirukka",
    "i do not know": "enakku theriyala",
    "i don't know": "enakku theriyala",
    "what happened": "enna aachu",
    "please help": "dhayavu senju help pannunga",
}

WORD_MAP = {
    "hello": "vanakkam",
    "hi": "hi",
    "welcome": "varaverkiren",
    "yes": "aama",
    "no": "illa",
    "please": "dhayavu senju",
    "sorry": "mannichidungo",
    "thanks": "nandri",
    "today": "innikku",
    "tomorrow": "naalaikku",
    "yesterday": "netru",
    "now": "ippo",
    "later": "apparam",
    "water": "thanni",
    "food": "saapadu",
    "home": "veedu",
    "office": "office",
    "friend": "nanban",
    "friends": "nanbargal",
    "work": "velai",
    "meeting": "meeting",
    "project": "project",
    "report": "report",
    "send": "anuppu",
    "share": "share pannu",
    "call": "koopdu",
    "come": "vaa",
    "go": "po",
    "wait": "wait pannu",
    "start": "start pannu",
    "stop": "niruthu",
    "open": "open pannu",
    "close": "close pannu",
    "help": "help pannu",
    "check": "check pannu",
    "finish": "mudichidu",
    "done": "mudinjudhu",
    "ready": "ready",
    "beautiful": "azhagaana",
    "super": "super",
    "quickly": "seekiram",
    "slowly": "medhuva",
    "big": "periya",
    "small": "chinna",
}

PUNCTUATION_PATTERN = re.compile(r"([,.!?;:])")
MULTI_SPACE_PATTERN = re.compile(r"\s{2,}")


class TanglishService:
    def convert(self, request: ConvertRequest) -> ConvertResponse:
        source = request.text.strip()
        output = source
        applied_rules: list[str] = []

        for phrase, replacement in sorted(PHRASE_MAP.items(), key=lambda item: len(item[0]), reverse=True):
            pattern = re.compile(rf"\b{re.escape(phrase)}\b", re.IGNORECASE)
            output, count = pattern.subn(replacement, output)
            if count:
                applied_rules.append(f"phrase:{phrase}")

        output = self._translate_sentence_patterns(output, applied_rules)
        output = self._translate_word_by_word(output, request.preserve_unknown_words, applied_rules)
        output = self._cleanup_spacing(output)

        return ConvertResponse(
            source_text=source,
            tanglish_text=output,
            engine=request.engine,
            fully_matched=not self._contains_residual_english_words(output),
            applied_rules=applied_rules,
            note="Rule-based starter engine. Unknown terms stay phonetic so an AI transliterator can replace them later.",
        )

    def _translate_sentence_patterns(self, text: str, applied_rules: list[str]) -> str:
        patterns = [
            (re.compile(r"^\s*i need (?P<value>.+)$", re.IGNORECASE), lambda m: f"enakku {m.group('value').strip()} venum", "pattern:i need"),
            (re.compile(r"^\s*i want (?P<value>.+)$", re.IGNORECASE), lambda m: f"enakku {m.group('value').strip()} venum", "pattern:i want"),
            (re.compile(r"^\s*where is (?P<value>.+)$", re.IGNORECASE), lambda m: f"{m.group('value').strip()} enga irukku", "pattern:where is"),
            (re.compile(r"^\s*can you (?P<value>.+)\??$", re.IGNORECASE), lambda m: f"{m.group('value').strip()} panna mudiyuma?", "pattern:can you"),
            (re.compile(r"^\s*please (?P<value>.+)$", re.IGNORECASE), lambda m: f"dhayavu senju {m.group('value').strip()}", "pattern:please"),
        ]
        for pattern, transform, rule in patterns:
            if pattern.search(text):
                applied_rules.append(rule)
                return pattern.sub(lambda match: transform(match), text, count=1)
        return text

    def _translate_word_by_word(self, text: str, preserve_unknown_words: bool, applied_rules: list[str]) -> str:
        tokens = PUNCTUATION_PATTERN.sub(r" \1 ", text).split()
        result: list[str] = []
        for token in tokens:
            if PUNCTUATION_PATTERN.fullmatch(token):
                result.append(token)
                continue
            mapped = WORD_MAP.get(token.lower())
            if mapped:
                applied_rules.append(f"word:{token.lower()}")
                result.append(self._match_token_case(token, mapped))
            elif preserve_unknown_words:
                result.append(self._apply_phonetic_fallback(token))
        return " ".join(result)

    @staticmethod
    def _apply_phonetic_fallback(token: str) -> str:
        transformed = token
        for pattern, replacement in [
            (r"tion$", "shan"),
            (r"the", "dha"),
            (r"th", "dh"),
            (r"oo", "u"),
            (r"ph", "f"),
            (r"w", "v"),
        ]:
            transformed = re.sub(pattern, replacement, transformed, flags=re.IGNORECASE)
        return transformed

    @staticmethod
    def _cleanup_spacing(text: str) -> str:
        cleaned = MULTI_SPACE_PATTERN.sub(" ", text).strip()
        return re.sub(r"\s+([,.!?;:])", r"\1", cleaned)

    @staticmethod
    def _match_token_case(source: str, target: str) -> str:
        if source.isupper():
            return target.upper()
        if source[:1].isupper():
            return target[:1].upper() + target[1:]
        return target

    @staticmethod
    def _contains_residual_english_words(text: str) -> bool:
        translated_values = list(PHRASE_MAP.values())
        for token in text.split():
            lowered = token.strip(",.!?;:").lower()
            if len(lowered) <= 2 or lowered in WORD_MAP:
                continue
            if any(lowered in value.lower() for value in translated_values):
                continue
            if lowered.isascii() and any(character.isalpha() for character in lowered):
                return True
        return False


tanglish_service = TanglishService()
