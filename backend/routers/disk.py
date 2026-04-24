from fastapi import APIRouter, Depends
from backend.auth import verify_api_key
from backend.services import disk_service, alert_service

router = APIRouter(prefix="/api", tags=["disk"], dependencies=[Depends(verify_api_key)])


@router.get("/disk")
def get_disk():
    result = disk_service.get_disk_usage()
    if result["status"] in ("warning", "critical"):
        alert_service.send_alert(
            f"Disk {result['status'].upper()}: {result['usage_percent']}% used",
            f"GitLab disk usage is at {result['usage_percent']}% ({result['used_gb']}GB / {result['total_gb']}GB).",
        )
    return result
