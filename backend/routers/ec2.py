from fastapi import APIRouter, Depends
from backend.auth import verify_api_key
from backend.services import ec2_service

router = APIRouter(prefix="/api", tags=["ec2"], dependencies=[Depends(verify_api_key)])


@router.get("/status")
def status():
    return ec2_service.get_instance_status()


@router.post("/start")
def start():
    return ec2_service.start_instance()


@router.post("/stop")
def stop():
    return ec2_service.stop_instance()
