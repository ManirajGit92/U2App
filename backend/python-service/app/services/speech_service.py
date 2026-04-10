import httpx

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.schemas.tanglish import SpeakRequest


CONTENT_TYPES = {
    "wav": "audio/wav",
    "flac": "audio/flac",
    "aac": "audio/aac",
    "opus": "audio/opus",
    "pcm": "audio/pcm",
    "mp3": "audio/mpeg",
}


class SpeechService:
    async def synthesize(self, payload: SpeakRequest) -> tuple[bytes, str, str]:
        settings = get_settings()
        if not settings.openai_api_key:
            raise AppError("Set OPENAI_API_KEY in the environment before calling /speak.", status_code=503)

        async with httpx.AsyncClient(base_url=settings.openai_base_url, timeout=90.0) as client:
            response = await client.post(
                "audio/speech",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.speech_model,
                    "input": payload.text,
                    "voice": payload.voice,
                    "speed": payload.speed,
                    "response_format": payload.format,
                    "instructions": payload.instructions,
                },
            )

        if response.status_code >= 400:
            raise AppError(
                f"OpenAI speech request failed with {response.status_code}: {response.text}",
                status_code=502,
            )

        extension = payload.format.lower()
        return response.content, CONTENT_TYPES.get(extension, "audio/mpeg"), f"tanglish-speech.{extension}"


speech_service = SpeechService()
