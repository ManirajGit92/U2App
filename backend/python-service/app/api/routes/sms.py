from fastapi import APIRouter, Form, Request
from fastapi.responses import Response

from app.schemas.game import SmsMessageRequest
from app.services.game_runtime import game_runtime


router = APIRouter()


@router.post("/mock")
async def mock_sms(payload: SmsMessageRequest) -> dict[str, bool]:
    await game_runtime.handle_sms_answer(payload.phone, payload.message)
    return {"ok": True}


@router.post("/webhook")
async def twilio_webhook(From: str = Form(default=""), Body: str = Form(default="")) -> Response:
    await game_runtime.handle_sms_answer(From, Body.strip())
    return Response(content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>', media_type="text/xml")


@router.api_route("/msg91", methods=["GET", "POST"])
async def msg91_webhook(request: Request) -> dict[str, bool]:
    if request.method == "POST":
        form_data = await request.form()
        sender = str(form_data.get("sender", ""))
        message = str(form_data.get("message", ""))
    else:
        sender = request.query_params.get("sender", "")
        message = request.query_params.get("message", "")
    await game_runtime.handle_sms_answer(sender, message.strip())
    return {"ok": True}
