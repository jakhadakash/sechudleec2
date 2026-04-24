from fastapi import APIRouter, Depends
from backend.auth import verify_api_key
from backend.services.audit_service import get_audit_logs

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", dependencies=[Depends(verify_api_key)])
def get_audit():
    """Get recent audit logs (last 20 changes)."""
    return {"logs": get_audit_logs(limit=20)}
