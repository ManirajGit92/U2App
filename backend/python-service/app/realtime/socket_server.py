import logging

import socketio

from app.services.game_runtime import game_runtime


logger = logging.getLogger("u2app.socketio")


def register_socket_events(sio: socketio.AsyncServer) -> None:
    async def broadcast(event: str, payload: dict) -> None:
        await sio.emit(event, payload)

    game_runtime.broadcast_callback = broadcast

    @sio.event
    async def connect(sid: str, environ: dict, auth: dict | None) -> None:
        logger.info("Client connected: %s", sid)
        await sio.emit("game_state", game_runtime.get_public_state().model_dump(mode="json"), to=sid)

    @sio.event
    async def disconnect(sid: str) -> None:
        logger.info("Client disconnected: %s", sid)
