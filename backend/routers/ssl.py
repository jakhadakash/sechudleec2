from fastapi import APIRouter, Depends
from backend.auth import verify_api_key
from backend.services import ssl_service, alert_service

router = APIRouter(prefix="/api", tags=["ssl"], dependencies=[Depends(verify_api_key)])


@router.get("/ssl")
def get_ssl():
    results = ssl_service.check_all_domains()
    for cert in results:
        if cert["status"] == "critical":
            alert_service.send_alert(
                f"SSL CRITICAL: {cert['domain']}",
                f"SSL certificate for {cert['domain']} expires in {cert['days_remaining']} days ({cert['expiry_date']}).",
            )
    return results
