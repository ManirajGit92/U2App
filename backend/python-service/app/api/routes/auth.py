from fastapi import APIRouter, Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.core.security import create_access_token, verify_password
from app.schemas.auth import LoginRequest, TokenResponse


router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, settings: Settings = Depends(get_settings)) -> TokenResponse:
    stored_password = settings.admin_password
    password_valid = verify_password(payload.password, stored_password) if stored_password.startswith("$2") else payload.password == stored_password
    if payload.username != settings.admin_username or not password_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(settings.admin_username, settings))
