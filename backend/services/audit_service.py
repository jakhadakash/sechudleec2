import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

AUDIT_LOG_FILE = Path(__file__).parent.parent / "audit_log.json"
MAX_ENTRIES = 20


def _load_logs() -> List[Dict]:
    """Load existing audit logs from file."""
    if not AUDIT_LOG_FILE.exists():
        return []
    try:
        with open(AUDIT_LOG_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def _save_logs(logs: List[Dict]) -> None:
    """Save audit logs to file."""
    try:
        with open(AUDIT_LOG_FILE, "w") as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        print(f"Failed to save audit log: {e}")


def log_action(
    action: str,
    details: Dict,
    user: Optional[str] = None,
    status: str = "success"
) -> None:
    """
    Log an action to the audit log.
    
    Args:
        action: Type of action (e.g., "instance_start", "schedule_update")
        details: Additional details about the action
        user: User who performed the action (optional)
        status: Status of the action ("success" or "error")
    """
    logs = _load_logs()
    
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "status": status,
        "details": details,
    }
    
    if user:
        entry["user"] = user
    
    # Add to beginning and keep only last MAX_ENTRIES
    logs.insert(0, entry)
    logs = logs[:MAX_ENTRIES]
    
    _save_logs(logs)


def get_audit_logs(limit: int = 20) -> List[Dict]:
    """
    Get recent audit logs.
    
    Args:
        limit: Maximum number of entries to return
    
    Returns:
        List of audit log entries (most recent first)
    """
    logs = _load_logs()
    return logs[:limit]


def clear_audit_logs() -> None:
    """Clear all audit logs."""
    _save_logs([])
