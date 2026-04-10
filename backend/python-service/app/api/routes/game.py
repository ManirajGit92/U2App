from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import Response

from app.core.exceptions import AppError
from app.core.security import require_admin
from app.schemas.game import ConfigLoadResponse, GameControlRequest, GameStateResponse, PhonebookUpsert
from app.services.game_runtime import game_runtime


router = APIRouter()


@router.get("/state", response_model=GameStateResponse)
async def get_state() -> GameStateResponse:
    return game_runtime.get_public_state()


@router.post("/control")
async def control_game(payload: GameControlRequest, _: str = Depends(require_admin)) -> dict[str, str | bool]:
    try:
        return await game_runtime.control(payload)
    except ValueError as exc:
        raise AppError(str(exc), status_code=status.HTTP_400_BAD_REQUEST) from exc


@router.post("/upload-config", response_model=ConfigLoadResponse)
async def upload_config(file: UploadFile = File(...), _: str = Depends(require_admin)) -> ConfigLoadResponse:
    questions, players = await game_runtime.load_excel_config(await file.read())
    return ConfigLoadResponse(ok=True, questions=questions, players=players)


@router.get("/template")
async def download_template() -> Response:
    return Response(
        content=game_runtime.build_template_workbook(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="GameConfig_Template.xlsx"'},
    )


@router.get("/export-scores")
async def export_scores(_: str = Depends(require_admin)) -> Response:
    return Response(
        content=game_runtime.build_leaderboard_workbook(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="GameLeaderboard.xlsx"'},
    )


@router.post("/phonebook")
async def upsert_phonebook(payload: PhonebookUpsert, _: str = Depends(require_admin)) -> dict[str, bool]:
    await game_runtime.upsert_phonebook(payload)
    return {"ok": True}


@router.get("/phonebook")
async def get_phonebook(_: str = Depends(require_admin)) -> dict[str, str]:
    return game_runtime.get_phonebook()

