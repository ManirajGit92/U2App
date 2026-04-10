from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import get_settings


router = APIRouter()


@router.get("/")
async def root() -> dict[str, object]:
    return {
        "name": get_settings().app_name,
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat(),
        "endpoints": ["/convert", "/speak", "/api/game/state", "/api/auth/login"],
    }


@router.get("/api/health")
async def health() -> dict[str, object]:
    return {"ok": True, "timestamp": datetime.now(UTC).isoformat()}
