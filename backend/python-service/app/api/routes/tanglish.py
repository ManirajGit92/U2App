from fastapi import APIRouter
from fastapi.responses import Response

from app.schemas.tanglish import ConvertRequest, ConvertResponse, SpeakRequest
from app.services.speech_service import speech_service
from app.services.tanglish_service import tanglish_service


router = APIRouter()


@router.post("/convert", response_model=ConvertResponse)
async def convert(payload: ConvertRequest) -> ConvertResponse:
    return tanglish_service.convert(payload)


@router.post("/speak")
async def speak(payload: SpeakRequest) -> Response:
    audio_bytes, content_type, filename = await speech_service.synthesize(payload)
    return Response(content=audio_bytes, media_type=content_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})
