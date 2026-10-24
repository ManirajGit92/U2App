import os
import io
import re
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Response, Request, UploadFile, File
from pydantic import BaseModel
from dotenv import load_dotenv
import azure.cognitiveservices.speech as speechsdk

# Load environment variables
current_dir = Path(__file__).resolve().parent
python_service_dir = current_dir.parent
env_candidates = [
    python_service_dir / ".env",
    current_dir / ".env",
]
for env_file in env_candidates:
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
load_dotenv()

SPEECH_KEY = (
    os.getenv("AZURE_TEXT_TO_SPEECH_KEY")
    or os.getenv("AZURE_SPEECH_KEY")
    or os.getenv("API_KEY2")
    or os.getenv("API_KEY")
    or ""
)

SPEECH_ENDPOINT = (
    os.getenv("AZURE_TEXT_TO_SPEECH_ENDPOINT")
    or os.getenv("AZURE_SPEECH_ENDPOINT")
    or "https://manifoundryresource3.cognitiveservices.azure.com/"
)

router = APIRouter(prefix="/api/voice", tags=["Voice Interaction"])

# Cache for voices
CACHED_VOICES = None

DEFAULT_VOICES = [
    {
        "name": "en-US-JennyNeural",
        "displayName": "Jenny (US - Female, Warm & Natural)",
        "locale": "en-US",
        "gender": "Female",
    },
    {
        "name": "en-US-AvaNeural",
        "displayName": "Ava (US - Female, Expressive)",
        "locale": "en-US",
        "gender": "Female",
    },
    {
        "name": "en-US-EmmaNeural",
        "displayName": "Emma (US - Female, Friendly)",
        "locale": "en-US",
        "gender": "Female",
    },
    {
        "name": "en-US-AriaNeural",
        "displayName": "Aria (US - Female, Confident)",
        "locale": "en-US",
        "gender": "Female",
    },
    {
        "name": "en-US-GuyNeural",
        "displayName": "Guy (US - Male, Natural)",
        "locale": "en-US",
        "gender": "Male",
    },
    {
        "name": "en-US-AndrewNeural",
        "displayName": "Andrew (US - Male, Conversational)",
        "locale": "en-US",
        "gender": "Male",
    },
    {
        "name": "en-US-BrianNeural",
        "displayName": "Brian (US - Male, Professional)",
        "locale": "en-US",
        "gender": "Male",
    },
    {
        "name": "en-GB-SoniaNeural",
        "displayName": "Sonia (UK - Female, Cheerful)",
        "locale": "en-GB",
        "gender": "Female",
    },
    {
        "name": "en-GB-RyanNeural",
        "displayName": "Ryan (UK - Male, Natural)",
        "locale": "en-GB",
        "gender": "Male",
    },
    {
        "name": "en-IN-NeerjaNeural",
        "displayName": "Neerja (India - Female, Friendly)",
        "locale": "en-IN",
        "gender": "Female",
    },
    {
        "name": "en-IN-PrabhatNeural",
        "displayName": "Prabhat (India - Male, Natural)",
        "locale": "en-IN",
        "gender": "Male",
    },
]


def clean_markdown_text(text: str) -> str:
    """Strips Markdown syntax, emojis, and symbols so TTS reads clean sentences."""
    if not text:
        return ""
    # Strip markdown code blocks
    cleaned = re.sub(r"```[\s\S]*?```", "", text)
    # Strip inline code
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    # Strip markdown headers, bold, italics
    cleaned = re.sub(r"[#*_~]", "", cleaned)
    # Strip markdown links [text](url) -> text
    cleaned = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", cleaned)
    # Strip URLs
    cleaned = re.sub(r"https?://\S+", "", cleaned)
    # Strip bullet emojis / common symbols
    cleaned = re.sub(r"[✅🚀👋💡⭐🎉•\-\—\(\)]", " ", cleaned)
    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-US-JennyNeural"
    rate: Optional[str] = None
    pitch: Optional[str] = None


@router.get("/voices")
def get_voices():
    """Returns available Microsoft Foundry / Azure Neural voices."""
    global CACHED_VOICES
    if CACHED_VOICES:
        return {"status": "success", "voices": CACHED_VOICES}

    try:
        speech_config = speechsdk.SpeechConfig(
            subscription=SPEECH_KEY, endpoint=SPEECH_ENDPOINT
        )
        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=None
        )
        voices_result = synthesizer.get_voices_async().get()
        if (
            voices_result.reason == speechsdk.ResultReason.VoicesListRetrieved
            and voices_result.voices
        ):
            mapped = []
            # First add our top curated voices in priority order
            curated_names = {v["name"] for v in DEFAULT_VOICES}
            mapped.extend(DEFAULT_VOICES)

            # Add other English voices
            for v in voices_result.voices:
                if v.short_name not in curated_names and v.locale.startswith("en"):
                    gender_str = "Female" if v.gender == 1 else "Male" if v.gender == 2 else "Unknown"
                    mapped.append(
                        {
                            "name": v.short_name,
                            "displayName": f"{v.local_name or v.short_name} ({v.locale} - {gender_str})",
                            "locale": v.locale,
                            "gender": gender_str,
                        }
                    )
            CACHED_VOICES = mapped
            return {"status": "success", "voices": CACHED_VOICES}
    except Exception as e:
        print(f"Warning: Failed to fetch dynamic voices from Azure: {e}")

    # Fallback to curated neural voices
    CACHED_VOICES = DEFAULT_VOICES
    return {"status": "success", "voices": CACHED_VOICES}


@router.post("/tts")
def synthesize_speech(req: TTSRequest):
    """
    Synthesizes speech using Microsoft Azure Cognitive Services (connected to Microsoft Foundry).
    Returns audio/wav bytes stream.
    """
    clean_text = clean_markdown_text(req.text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        speech_config = speechsdk.SpeechConfig(
            subscription=SPEECH_KEY, endpoint=SPEECH_ENDPOINT
        )
        voice_name = req.voice or "en-US-JennyNeural"
        speech_config.speech_synthesis_voice_name = voice_name
        # 24kHz 16-bit Mono PCM WAV format — crisp and natively supported by HTML5 Audio
        speech_config.set_speech_synthesis_output_format(
            speechsdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
        )

        synthesizer = speechsdk.SpeechSynthesizer(
            speech_config=speech_config, audio_config=None
        )

        result = synthesizer.speak_text_async(clean_text).get()

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            return Response(
                content=result.audio_data,
                media_type="audio/wav",
                headers={
                    "Content-Disposition": "inline; filename=speech.wav",
                    "Cache-Control": "no-cache",
                },
            )
        elif result.reason == speechsdk.ResultReason.Canceled:
            details = result.cancellation_details
            error_msg = f"TTS Canceled: {details.reason}. {details.error_details}"
            print(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        else:
            raise HTTPException(
                status_code=500, detail=f"TTS Failed with reason: {result.reason}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech synthesis error: {str(e)}")


class STTRequest(BaseModel):
    audio_base64: Optional[str] = None


@router.post("/stt")
async def speech_to_text(request: Request):
    """
    Transcribes audio into text using Microsoft Azure Speech SDK (STT.py implementation).
    Accepts raw audio binary in request body or JSON with { "audio_base64": "..." }.
    """
    try:
        audio_bytes = b""
        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:
            body_json = await request.json()
            b64_str = body_json.get("audio_base64", "")
            if b64_str:
                import base64
                if "," in b64_str:
                    b64_str = b64_str.split(",", 1)[1]
                audio_bytes = base64.b64decode(b64_str)
        else:
            audio_bytes = await request.body()

        if not audio_bytes or len(audio_bytes) < 44:
            raise HTTPException(
                status_code=400, detail="No audio data received or data too small."
            )

        speech_config = speechsdk.SpeechConfig(
            subscription=SPEECH_KEY, endpoint=SPEECH_ENDPOINT
        )

        # Use tempfile so Azure automatically detects audio formats (WAV, WebM, OGG, etc.)
        import tempfile
        suffix = ".wav" if audio_bytes.startswith(b"RIFF") else ".webm"
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
                tmp_path = tmp_file.name
                tmp_file.write(audio_bytes)

            audio_config = speechsdk.audio.AudioConfig(filename=tmp_path)
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config, audio_config=audio_config
            )
            result = recognizer.recognize_once_async().get()
        except Exception:
            # Fallback to PushAudioInputStream if file-based audio config is unavailable
            push_stream = speechsdk.audio.PushAudioInputStream()
            push_stream.write(audio_bytes)
            push_stream.close()
            audio_config = speechsdk.audio.AudioConfig(stream=push_stream)
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config, audio_config=audio_config
            )
            result = recognizer.recognize_once_async().get()
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return {
                "status": "success",
                "text": result.text.strip(),
            }
        elif result.reason == speechsdk.ResultReason.NoMatch:
            return {
                "status": "no_match",
                "text": "",
                "detail": "No speech could be recognized.",
            }
        elif result.reason == speechsdk.ResultReason.Canceled:
            cancellation = result.cancellation_details
            return {
                "status": "error",
                "text": "",
                "detail": f"Recognition canceled: {cancellation.reason}. {cancellation.error_details}",
            }
        else:
            return {
                "status": "error",
                "text": "",
                "detail": f"Recognition ended with reason: {result.reason}",
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Speech recognition error: {str(e)}"
        )

