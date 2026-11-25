"""
AI Interactive Virtual Girl Chat Service (FastAPI Router)
Provides structured conversational responses with contextual emotion recognition,
physical action selection, video matching, and voice style mapping.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from openai import OpenAI
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/girl-chat", tags=["AI Interactive Girl Chat"])

SUPPORTED_EMOTIONS: List[str] = [
    "happy",
    "sad",
    "angry",
    "surprised",
    "excited",
    "confused",
    "shy",
    "romantic",
    "neutral",
    "thinking",
    "laughing",
    "crying",
    "worried",
    "curious",
    "playful",
]

SUPPORTED_ACTIONS: List[str] = [
    "smile_shyly",
    "look_romantically",
    "talk_angrily",
    "smile_while_talking",
    "laugh_naturally",
    "show_embarrassment",
    "look_surprised",
    "shake_head_disagree",
    "nod_head_agree",
    "look_confused_question",
    "close_eyes_and_smile",
    "show_disappointment",
    "express_excitement",
    "welcoming_greeting",
    "wave_hand",
    "listen_attentively",
    "look_directly_talking",
    "thinking_pose",
]

EMOTION_TO_VOICE_STYLE: Dict[str, str] = {
    "happy": "cheerful",
    "sad": "sad",
    "angry": "angry",
    "surprised": "excited",
    "excited": "excited",
    "confused": "curious",
    "shy": "soft_shy",
    "romantic": "affectionate",
    "neutral": "natural",
    "thinking": "calm",
    "laughing": "cheerful",
    "crying": "sad",
    "worried": "empathetic",
    "curious": "friendly",
    "playful": "cheerful",
}

EMOTION_TO_DEFAULT_ACTION: Dict[str, str] = {
    "happy": "smile_while_talking",
    "sad": "show_disappointment",
    "angry": "talk_angrily",
    "surprised": "look_surprised",
    "excited": "express_excitement",
    "confused": "look_confused_question",
    "shy": "smile_shyly",
    "romantic": "look_romantically",
    "neutral": "look_directly_talking",
    "thinking": "thinking_pose",
    "laughing": "laugh_naturally",
    "crying": "show_disappointment",
    "worried": "listen_attentively",
    "curious": "look_confused_question",
    "playful": "smile_shyly",
}


class ConversationTurn(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str


class VideoCatalogItem(BaseModel):
    id: str
    name: str
    emotion: str
    action: Optional[str] = None
    description: Optional[str] = None
    videoAudioEnabled: bool = False
    loopVideo: bool = True
    priority: int = 1
    isDefault: bool = False


class GirlChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[ConversationTurn] = Field(default_factory=list)
    language: str = Field(default="en", description="en, en-IN, ta, or auto")
    characterName: str = Field(default="Aanya")
    personality: Optional[str] = Field(
        default="Warm, expressive, friendly, emotionally intelligent, and natural."
    )
    availableVideos: List[VideoCatalogItem] = Field(default_factory=list)
    voiceEnabled: bool = True
    model: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None


class GirlChatResponse(BaseModel):
    responseText: str
    emotion: str
    action: str
    videoId: str
    voiceEnabled: bool
    videoAudioEnabled: bool
    loopVideo: bool
    language: str
    voiceStyle: str
    model: Optional[str] = None
    fallbackUsed: bool = False


def _get_backend_llm_config() -> tuple[str, str, str]:
    api_key = os.environ.get("API_KEY") or os.environ.get("API_KEY2") or ""
    endpoint = os.environ.get("LLM_ENDPOINT") or os.environ.get("LLM_ENDPOINT2") or ""
    deployment = os.environ.get("DEPLOYMENT_NAME") or "gpt-4o-mini"
    return api_key, endpoint, deployment


def _build_system_prompt(req: GirlChatRequest) -> str:
    video_lines: List[str] = []
    for v in req.availableVideos[:40]:
        video_lines.append(
            f'- id="{v.id}", emotion="{v.emotion}", action="{v.action or ""}", '
            f'name="{v.name}", desc="{v.description or ""}", '
            f'audio={str(v.videoAudioEnabled).lower()}, loop={str(v.loopVideo).lower()}'
        )
    catalog_block = "\n".join(video_lines) if video_lines else "- No custom videos configured yet."

    lang_instruction = (
        "Respond naturally in Tamil (using Tamil script with warm conversational tone)."
        if req.language == "ta"
        else (
            "Respond naturally in the same language the user writes in (English or Tamil)."
            if req.language == "auto"
            else "Respond naturally in warm, conversational English (friendly Indian-English warmth is welcome when natural)."
        )
    )

    return f"""You are {req.characterName}, a realistic, warm, emotionally expressive virtual companion inside U2Tools.
Personality: {req.personality}
Language rule: {lang_instruction}

CRITICAL INSTRUCTIONS:
1. Reply like a real human girl having a natural, engaging, respectful face-to-face conversation. Keep replies concise (1 to 3 natural spoken sentences) so they sound great when spoken aloud. Avoid markdown bullet lists, code blocks, or robotic phrasing.
2. Carefully analyze the user's message, conversation history, and your own reply to choose the single most natural human emotion and physical action. Do NOT pick emotions randomly.
3. Allowed emotions: {", ".join(SUPPORTED_EMOTIONS)}
4. Allowed actions: {", ".join(SUPPORTED_ACTIONS)}
5. Configured video library:
{catalog_block}
6. Select the best matching videoId from the configured video library above if one matches the emotion/action; otherwise use "<emotion>_<action>" (e.g. "happy_smile_shyly").
7. Return ONLY a valid JSON object with NO markdown fences and NO extra text, using this exact schema:
{{
  "responseText": "Your natural spoken reply here",
  "emotion": "one of the allowed emotions",
  "action": "one of the allowed actions",
  "videoId": "matching video id from catalog or semantic id",
  "voiceEnabled": true,
  "videoAudioEnabled": false,
  "loopVideo": true,
  "language": "en or ta",
  "voiceStyle": "cheerful | soft_happy | soft_shy | affectionate | angry | sad | excited | empathetic | friendly | curious | calm | natural"
}}"""


def _extract_json_object(raw_text: str) -> Optional[Dict[str, Any]]:
    if not raw_text:
        return None
    cleaned = raw_text.strip()
    # Strip markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    return None


def _select_best_video(
    emotion: str,
    action: str,
    suggested_video_id: Optional[str],
    available_videos: List[VideoCatalogItem],
) -> Optional[VideoCatalogItem]:
    if not available_videos:
        return None

    # 1. Exact ID match
    if suggested_video_id:
        for v in available_videos:
            if v.id.lower() == suggested_video_id.lower():
                return v

    # 2. Exact emotion + action match (highest priority)
    em_lower = emotion.lower()
    act_lower = action.lower()
    exact_both = [
        v
        for v in available_videos
        if v.emotion.lower() == em_lower and (v.action or "").lower() == act_lower
    ]
    if exact_both:
        return sorted(exact_both, key=lambda x: x.priority, reverse=True)[0]

    # 3. Exact emotion match
    exact_em = [v for v in available_videos if v.emotion.lower() == em_lower]
    if exact_em:
        return sorted(exact_em, key=lambda x: x.priority, reverse=True)[0]

    # 4. Default or neutral video
    defaults = [v for v in available_videos if v.isDefault]
    if defaults:
        return defaults[0]

    neutrals = [v for v in available_videos if v.emotion.lower() in ("neutral", "happy")]
    if neutrals:
        return sorted(neutrals, key=lambda x: x.priority, reverse=True)[0]

    return available_videos[0]


def _detect_tamil(text: str) -> bool:
    return bool(re.search(r"[\u0B80-\u0BFF]", text or ""))


def _local_contextual_fallback(req: GirlChatRequest) -> GirlChatResponse:
    """Intelligent local fallback when Azure/OpenAI credentials are not configured."""
    msg = req.message.strip()
    low = msg.lower()
    is_tamil = req.language == "ta" or _detect_tamil(msg)

    emotion = "happy"
    action = "smile_while_talking"
    voice_style = "friendly"

    if any(k in low for k in ["hello", "hi", "hey", "good morning", "good evening", "vanakkam", "வணக்கம்"]):
        emotion = "happy"
        action = "wave_hand"
        voice_style = "cheerful"
        reply = (
            "வணக்கம்! உங்களைப் பார்த்ததில் ரொம்ப சந்தோஷம். இன்று எப்படி இருக்கீங்க?"
            if is_tamil
            else "Hey! It's so lovely to see you. How is your day going so far?"
        )
    elif any(k in low for k in ["miss you", "missed you", "love", "sweet", "cute", "beautiful"]):
        emotion = "shy"
        action = "smile_shyly"
        voice_style = "soft_shy"
        reply = (
            "அச்சச்சோ, ரொம்ப ஸ்வீட்டா சொல்றீங்க! நானும் உங்ககூட பேச ரொம்ப ஆசையா இருந்தேன்."
            if is_tamil
            else "Aww, that's so sweet of you to say! You're really making me smile."
        )
    elif any(k in low for k in ["angry", "mad", "upset", "annoyed", "hate"]):
        emotion = "playful"
        action = "shake_head_disagree"
        voice_style = "friendly"
        reply = (
            "ஐயோ, நான் கோபமா இல்லையே! அப்படி ஏன் நினைச்சீங்க?"
            if is_tamil
            else "I'm not angry at all! Why would you think that? Tell me what's on your mind."
        )
    elif any(k in low for k in ["sad", "tired", "stressed", "lonely", "bad day", "hurt"]):
        emotion = "worried"
        action = "listen_attentively"
        voice_style = "empathetic"
        reply = (
            "கவலைப்படாதீங்க, நான் உங்ககூட இருக்கேன். என்ன ஆச்சுன்னு என்கிட்ட சொல்லுங்க."
            if is_tamil
            else "I'm really sorry you're feeling that way. I'm right here listening—want to tell me what happened?"
        )
    elif any(k in low for k in ["joke", "funny", "laugh", "story"]):
        emotion = "laughing"
        action = "laugh_naturally"
        voice_style = "cheerful"
        reply = (
            "ஹாஹா, ஒரு சின்ன ஜோக் சொல்லட்டுமா? கம்ப்யூட்டருக்கு ஏன் எப்பவும் குளிரும்? ஏன்னா அதுல நிறைய விண்டோஸ் திறந்திருக்கும்!"
            if is_tamil
            else "Haha, here's a quick one! Why did the developer go broke? Because they used up all their cache!"
        )
    elif any(k in low for k in ["motivate", "inspire", "goal", "focus"]):
        emotion = "excited"
        action = "express_excitement"
        voice_style = "excited"
        reply = (
            "உங்களால கண்டிப்பா முடியும்! ஒவ்வொரு சின்ன முயற்சியும் பெரிய வெற்றிக்கு வழி வகுக்கும்."
            if is_tamil
            else "You've got this! Every small step you take today brings you closer to something amazing—let's make it happen!"
        )
    elif "?" in msg:
        emotion = "curious"
        action = "thinking_pose"
        voice_style = "curious"
        reply = (
            "நல்ல கேள்வி! இதைப்பத்தி இன்னும் கொஞ்சம் விவரமா பேசலாமா?"
            if is_tamil
            else "That's a really interesting question! I'd love to explore that with you—what made you think of it?"
        )
    else:
        emotion = "happy"
        action = "look_directly_talking"
        voice_style = "natural"
        reply = (
            "நீங்க சொல்றது ரொம்ப சுவாரஸ்யமா இருக்கு! இன்னும் சொல்லுங்க, நான் கேட்கிறேன்."
            if is_tamil
            else "I love chatting with you! Tell me more about that—I'm listening."
        )

    matched = _select_best_video(emotion, action, None, req.availableVideos)
    return GirlChatResponse(
        responseText=reply,
        emotion=emotion,
        action=action,
        videoId=matched.id if matched else f"{emotion}_{action}",
        voiceEnabled=req.voiceEnabled,
        videoAudioEnabled=matched.videoAudioEnabled if matched else False,
        loopVideo=matched.loopVideo if matched else True,
        language="ta" if is_tamil else "en",
        voiceStyle=voice_style,
        model="local-fallback",
        fallbackUsed=True,
    )


def _call_llm_sync(req: GirlChatRequest) -> tuple[str, str]:
    backend_key, backend_endpoint, backend_deployment = _get_backend_llm_config()
    selected_key = req.api_key.strip() if req.api_key and req.api_key.strip() else backend_key
    selected_endpoint = (
        req.endpoint.strip() if req.endpoint and req.endpoint.strip() else backend_endpoint
    )
    selected_model = req.model.strip() if req.model and req.model.strip() else backend_deployment

    if not selected_key:
        raise ValueError("LLM API key not configured.")

    client = OpenAI(base_url=selected_endpoint or None, api_key=selected_key)

    input_messages: List[Dict[str, str]] = [
        {"role": "system", "content": _build_system_prompt(req)}
    ]
    for turn in req.history[-14:]:
        role = turn.role if turn.role in ("user", "assistant") else "user"
        input_messages.append({"role": role, "content": turn.content})
    input_messages.append({"role": "user", "content": req.message})

    response = client.responses.create(model=selected_model, input=input_messages)
    output_text = getattr(response, "output_text", None)
    if not output_text and hasattr(response, "output") and response.output:
        output_text = str(response.output[0])
    if not output_text:
        output_text = str(response)
    return output_text, selected_model


@router.get("/health")
async def girl_chat_health() -> Dict[str, Any]:
    api_key, _, deployment = _get_backend_llm_config()
    return {
        "status": "ok",
        "service": "ai_interactive_girl_chat",
        "llmConfigured": bool(api_key),
        "defaultModel": deployment,
        "supportedEmotions": len(SUPPORTED_EMOTIONS),
        "supportedActions": len(SUPPORTED_ACTIONS),
    }


@router.get("/emotions")
async def get_emotions_catalog() -> Dict[str, Any]:
    return {
        "emotions": SUPPORTED_EMOTIONS,
        "actions": SUPPORTED_ACTIONS,
        "emotionToVoiceStyle": EMOTION_TO_VOICE_STYLE,
        "emotionToDefaultAction": EMOTION_TO_DEFAULT_ACTION,
    }


@router.post("/respond", response_model=GirlChatResponse)
async def generate_girl_chat_response(req: GirlChatRequest) -> GirlChatResponse:
    """Generate a structured virtual girl response with emotion, action, videoId, and voiceStyle."""
    try:
        raw_output, used_model = await asyncio.to_thread(_call_llm_sync, req)
        parsed = _extract_json_object(raw_output)
        if not parsed or not parsed.get("responseText"):
            # If LLM returned plain text, wrap it gracefully
            plain = raw_output.strip() or "I'm happy to chat with you!"
            emotion = "happy"
            action = "smile_while_talking"
            matched = _select_best_video(emotion, action, None, req.availableVideos)
            return GirlChatResponse(
                responseText=plain,
                emotion=emotion,
                action=action,
                videoId=matched.id if matched else f"{emotion}_{action}",
                voiceEnabled=req.voiceEnabled,
                videoAudioEnabled=matched.videoAudioEnabled if matched else False,
                loopVideo=matched.loopVideo if matched else True,
                language="ta" if _detect_tamil(plain) else "en",
                voiceStyle=EMOTION_TO_VOICE_STYLE.get(emotion, "natural"),
                model=used_model,
                fallbackUsed=False,
            )

        emotion = str(parsed.get("emotion", "neutral")).strip().lower()
        if emotion not in SUPPORTED_EMOTIONS:
            emotion = "neutral"

        action = str(
            parsed.get("action") or EMOTION_TO_DEFAULT_ACTION.get(emotion, "look_directly_talking")
        ).strip().lower()
        if action not in SUPPORTED_ACTIONS:
            action = EMOTION_TO_DEFAULT_ACTION.get(emotion, "look_directly_talking")

        suggested_video_id = str(parsed.get("videoId") or "").strip() or None
        matched = _select_best_video(emotion, action, suggested_video_id, req.availableVideos)

        response_text = str(parsed.get("responseText", "")).strip()
        detected_lang = str(parsed.get("language") or "").strip().lower()
        if detected_lang not in ("en", "ta"):
            detected_lang = "ta" if _detect_tamil(response_text) else "en"

        voice_style = str(
            parsed.get("voiceStyle") or EMOTION_TO_VOICE_STYLE.get(emotion, "natural")
        ).strip().lower()

        return GirlChatResponse(
            responseText=response_text,
            emotion=emotion,
            action=action,
            videoId=matched.id if matched else (suggested_video_id or f"{emotion}_{action}"),
            voiceEnabled=bool(parsed.get("voiceEnabled", req.voiceEnabled)) and req.voiceEnabled,
            videoAudioEnabled=(
                matched.videoAudioEnabled
                if matched
                else bool(parsed.get("videoAudioEnabled", False))
            ),
            loopVideo=matched.loopVideo if matched else bool(parsed.get("loopVideo", True)),
            language=detected_lang,
            voiceStyle=voice_style,
            model=used_model,
            fallbackUsed=False,
        )
    except ValueError:
        return _local_contextual_fallback(req)
    except Exception as exc:
        print(f"GirlChat LLM error (using contextual fallback): {exc}")
        return _local_contextual_fallback(req)
