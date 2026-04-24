# Audit Log Feature

## Overview

Added audit logging to track the last 20 changes made through the dashboard. Logs are stored locally in `backend/audit_log.json` and displayed in a new Audit Log card on the dashboard.

## What Gets Logged

### Instance Actions
- **Instance Start**: When EC2 instance is started
- **Instance Stop**: When EC2 instance is stopped (with graceful shutdown flag)

### Schedule Changes
- **Schedule Update**: When EventBridge schedule is modified
  - Logs old and new cron expressions
  - Logs which rule was updated (start/stop)
  - Logs Lambda ARN configuration

## Log Entry Format

```json
{
  "timestamp": "2026-04-24T10:19:39.412661Z",
  "action": "schedule_update",
  "status": "success",
  "details": {
    "rule_key": "daily_start",
    "rule_name": "gitlab-ec2-start-weekday",
    "old_schedule": "cron(0 9 ? * MON-SAT *)",
    "new_schedule": "cron(30 3 ? * MON-SAT *)",
    "lambda_arn": "arn:aws:lambda:ap-south-1:720712330515:function:gitlab-ec2-start"
  }
}
```

## API Endpoint

### GET /api/audit

Returns the last 20 audit log entries (most recent first).

**Request**:
```bash
curl -H "X-API-Key: YOUR_KEY" http://localhost:8000/api/audit | jq
```

**Response**:
```json
{
  "logs": [
    {
      "timestamp": "2026-04-24T10:19:39.412661Z",
      "action": "schedule_update",
      "status": "success",
      "details": { ... }
    },
    ...
  ]
}
```

## Frontend Display

New **Audit Log Card** shows:
- Last 20 changes
- Action icons (▶️ start, ⏹️ stop, 📅 schedule)
- Formatted timestamps (e.g., "Apr 24, 10:19 AM")
- Color-coded by status (green for success, red for errors)
- Scrollable list with max height
- Auto-refreshes every 30 seconds

## Files Modified

### Backend
- `backend/services/audit_service.py` - New audit logging service
- `backend/services/ec2_service.py` - Added logging to start/stop
- `backend/services/eventbridge_service.py` - Added logging to schedule updates
- `backend/routers/audit.py` - New API endpoint
- `backend/main.py` - Registered audit router
- `backend/audit_log.json` - Log storage (gitignored)

### Frontend
- `frontend-react/src/api/types.ts` - Added audit log types
- `frontend-react/src/api/client.ts` - Added auditLogs() method
- `frontend-react/src/components/dashboard/AuditLogCard.tsx` - New card component
- `frontend-react/src/App.tsx` - Added audit log card to dashboard

### Configuration
- `.gitignore` - Added `backend/audit_log.json`

## Usage

### Restart Backend

After pulling these changes, restart the backend to load the new audit module:

```bash
# If using systemd
sudo systemctl restart ec2-dashboard-backend

# If running manually
pkill -f "uvicorn backend.main"
cd ec2-dashboard/backend
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### View Logs

1. **Dashboard**: Open the dashboard and scroll to the Audit Log card
2. **API**: `curl -H "X-API-Key: YOUR_KEY" http://localhost:8000/api/audit | jq`
3. **File**: `cat backend/audit_log.json | jq`

### Clear Logs

```python
from backend.services.audit_service import clear_audit_logs
clear_audit_logs()
```

## Features

- ✅ Tracks last 20 changes (automatically rotates)
- ✅ Persists across backend restarts
- ✅ Shows in dashboard with auto-refresh
- ✅ Color-coded by status
- ✅ Formatted timestamps
- ✅ Action-specific icons
- ✅ Scrollable list
- ✅ No database required (JSON file)

## Future Enhancements

Possible additions:
- User tracking (if authentication is added)
- Export logs to CSV
- Filter by action type
- Search functionality
- Longer retention (configurable)
- Log rotation to separate files
- Integration with CloudWatch Logs
