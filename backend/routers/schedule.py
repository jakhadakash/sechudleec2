from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from backend.auth import verify_api_key
from backend.services import eventbridge_service

router = APIRouter(prefix="/api", tags=["schedule"], dependencies=[Depends(verify_api_key)])


class ScheduleUpdate(BaseModel):
    rule_key: str   # weekday_stop | weekday_start | weekend_stop | weekend_start
    cron_expression: str  # e.g. "cron(30 16 ? * MON-FRI *)"


@router.get("/schedule")
def get_schedule():
    return eventbridge_service.get_schedules()


@router.post("/schedule")
def update_schedule(body: ScheduleUpdate):
    try:
        return eventbridge_service.update_schedule(body.rule_key, body.cron_expression)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/schedule/configure-targets")
def configure_lambda_targets():
    """
    Configure Lambda function targets for all EventBridge rules.
    This endpoint is useful for initial setup or fixing missing targets.
    """
    return eventbridge_service.configure_all_lambda_targets()
