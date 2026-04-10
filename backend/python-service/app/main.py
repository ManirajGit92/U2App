from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, game, sms, system, tanglish
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.realtime.socket_server import register_socket_events
from app.services.game_runtime import game_runtime


settings = get_settings()
configure_logging(settings.log_level)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.allowed_origins or ["*"],
)
register_socket_events(sio)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await game_runtime.reset_runtime()
    yield


app = FastAPI(title="U2App Migrated Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(system.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(tanglish.router, tags=["tanglish"])
app.include_router(game.router, prefix="/api/game", tags=["game"])
app.include_router(sms.router, prefix="/api/sms", tags=["sms"])

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
