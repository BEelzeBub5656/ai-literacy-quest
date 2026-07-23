from fastapi import APIRouter, HTTPException

from campus_ai.core.config import get_settings
from campus_ai.modules.vision.schemas import RecognizeRequest, RecognizeResponse
from campus_ai.modules.vision.service import VisionService
from campus_ai.providers.vision_base import VisionProviderError


router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(payload: RecognizeRequest) -> RecognizeResponse:
    try:
        return await VisionService(get_settings()).recognize(payload)
    except VisionProviderError as error:
        raise HTTPException(
            status_code=502,
            detail="视觉识别服务暂时不可用。",
        ) from error
