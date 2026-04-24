from fastapi import APIRouter, Depends
from backend.auth import verify_api_key
from backend.services import cost_service

router = APIRouter(prefix="/api", tags=["cost"], dependencies=[Depends(verify_api_key)])


@router.get("/cost")
def get_cost():
    return cost_service.get_current_month_cost()
