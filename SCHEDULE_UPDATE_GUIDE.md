# Schedule Update Guide

## ✅ YES - Dashboard Updates AWS EventBridge!

When you change the schedule from the dashboard, it **directly updates AWS EventBridge rules** in real-time.

## How It Works

### 1. User Changes Schedule in Dashboard

User edits the schedule in the "Edit Schedule" card:
- Changes start time (e.g., 9:00am → 8:00am)
- Changes stop time (e.g., 9:00pm → 10:00pm)
- Changes days (e.g., Mon-Sat → Mon-Fri)

### 2. Frontend Sends API Request

```typescript
// Frontend API call
api.updateSchedule({
  rule_key: "daily_start",
  cron_expression: "cron(30 2 ? * MON-SAT *)"  // 8:00am IST
})
```

### 3. Backend Updates AWS EventBridge

```python
# backend/services/eventbridge_service.py

def update_schedule(rule_key: str, cron_expression: str) -> dict:
    # 1. Update EventBridge rule with new schedule
    events.put_rule(
        Name=rule_name,
        ScheduleExpression=cron_expression,
        State="ENABLED",
    )
    
    # 2. Reconfigure Lambda target (if needed)
    if lambda_arn:
        events.put_targets(
            Rule=rule_name,
            Targets=[{'Id': '1', 'Arn': lambda_arn}]
        )
    
    return {"updated_to": cron_expression}
```

### 4. AWS EventBridge Updated

The EventBridge rule in AWS is immediately updated with:
- ✅ New cron expression
- ✅ Rule state set to ENABLED
- ✅ Lambda target reconfigured

### 5. New Schedule Active

The new schedule takes effect immediately. Next execution will use the updated time.

## API Endpoints

### GET /api/schedule

**Purpose**: Get current schedules from AWS

**Request**:
```bash
curl -H "X-API-Key: YOUR_KEY" http://localhost:8000/api/schedule | jq
```

**Response**:
```json
{
  "daily_start": {
    "rule_name": "gitlab-ec2-start-weekday",
    "schedule": "cron(30 3 ? * MON-SAT *)",
    "state": "ENABLED",
    "description": "Start GitLab EC2 at 9:00am IST"
  },
  "daily_stop": {
    "rule_name": "gitlab-ec2-stop-weekday",
    "schedule": "cron(30 15 ? * MON-SAT *)",
    "state": "ENABLED",
    "description": "Stop GitLab EC2 at 9:00pm IST"
  }
}
```

### POST /api/schedule

**Purpose**: Update schedule in AWS

**Request**:
```bash
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_key": "daily_start",
    "cron_expression": "cron(0 4 ? * MON-FRI *)"
  }' \
  http://localhost:8000/api/schedule | jq
```

**Response**:
```json
{
  "rule_key": "daily_start",
  "rule_name": "gitlab-ec2-start-weekday",
  "updated_to": "cron(0 4 ? * MON-FRI *)"
}
```

**What Happens in AWS**:
1. EventBridge rule `gitlab-ec2-start-weekday` is updated
2. New cron expression: `cron(0 4 ? * MON-FRI *)`
3. Rule state: ENABLED
4. Lambda target: Reconfigured

### POST /api/schedule/configure-targets

**Purpose**: Configure Lambda targets for all rules

**Request**:
```bash
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  http://localhost:8000/api/schedule/configure-targets | jq
```

**Response**:
```json
{
  "daily_start": {
    "rule_name": "gitlab-ec2-start-weekday",
    "lambda_arn": "arn:aws:lambda:ap-south-1:720712330515:function:gitlab-ec2-start",
    "status": "success",
    "message": "Lambda target configured"
  },
  "daily_stop": {
    "rule_name": "gitlab-ec2-stop-weekday",
    "lambda_arn": "arn:aws:lambda:ap-south-1:720712330515:function:gitlab-ec2-stop",
    "status": "success",
    "message": "Lambda target configured"
  }
}
```

## Verification

### Check Schedule in Dashboard

1. Open dashboard
2. Look at "Active Schedule" card
3. See current start/stop times

### Check Schedule in AWS Console

1. Go to AWS Console → EventBridge
2. Click "Rules"
3. Find `gitlab-ec2-start-weekday` and `gitlab-ec2-stop-weekday`
4. Verify schedule expression matches dashboard

### Check Schedule via AWS CLI

```bash
# Get start rule
aws events describe-rule \
  --name gitlab-ec2-start-weekday \
  --region ap-south-1 \
  --query '{Schedule:ScheduleExpression,State:State}' \
  --output json

# Get stop rule
aws events describe-rule \
  --name gitlab-ec2-stop-weekday \
  --region ap-south-1 \
  --query '{Schedule:ScheduleExpression,State:State}' \
  --output json
```

## Cron Expression Format

EventBridge uses AWS cron format: `cron(minute hour day month weekday year)`

### Examples

| Time (IST) | UTC | Cron Expression | Days |
|------------|-----|-----------------|------|
| 9:00am IST | 3:30 UTC | `cron(30 3 ? * MON-SAT *)` | Mon-Sat |
| 8:00am IST | 2:30 UTC | `cron(30 2 ? * MON-SAT *)` | Mon-Sat |
| 10:00pm IST | 16:30 UTC | `cron(30 16 ? * MON-SAT *)` | Mon-Sat |
| 9:00am IST | 3:30 UTC | `cron(30 3 ? * MON-FRI *)` | Mon-Fri only |
| 9:00am IST | 3:30 UTC | `cron(30 3 ? * * *)` | Every day |

### IST to UTC Conversion

IST = UTC + 5:30

| IST | UTC |
|-----|-----|
| 12:00am | 6:30pm (previous day) |
| 6:00am | 12:30am |
| 9:00am | 3:30am |
| 12:00pm | 6:30am |
| 6:00pm | 12:30pm |
| 9:00pm | 3:30pm |

## Testing Schedule Updates

### Test 1: Update Start Time

```bash
# Change start time to 8:00am IST (2:30 UTC)
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_key": "daily_start",
    "cron_expression": "cron(30 2 ? * MON-SAT *)"
  }' \
  http://localhost:8000/api/schedule

# Verify in AWS
aws events describe-rule \
  --name gitlab-ec2-start-weekday \
  --region ap-south-1
```

### Test 2: Update Stop Time

```bash
# Change stop time to 10:00pm IST (16:30 UTC)
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_key": "daily_stop",
    "cron_expression": "cron(30 16 ? * MON-SAT *)"
  }' \
  http://localhost:8000/api/schedule

# Verify in AWS
aws events describe-rule \
  --name gitlab-ec2-stop-weekday \
  --region ap-south-1
```

### Test 3: Change Days

```bash
# Change to weekdays only (Mon-Fri)
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_key": "daily_start",
    "cron_expression": "cron(30 3 ? * MON-FRI *)"
  }' \
  http://localhost:8000/api/schedule
```

## Permissions Required

The IAM user/role needs these permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "events:DescribeRule",
    "events:PutRule",
    "events:PutTargets"
  ],
  "Resource": "arn:aws:events:*:*:rule/gitlab-ec2-*"
}
```

These are already included in `infra/iam_runtime_policy.json`.

## Automatic Lambda Target Configuration

When you update a schedule, the backend automatically:

1. ✅ Updates the EventBridge rule with new cron expression
2. ✅ Reconfigures the Lambda target (if Lambda ARN is set)
3. ✅ Ensures rule is ENABLED

This means you don't need to manually configure targets after updating schedules.

## Troubleshooting

### Schedule Not Updating

**Check**:
1. Backend has correct IAM permissions
2. Lambda ARNs are set in `.env`
3. EventBridge rules exist in AWS
4. API returns success response

**Debug**:
```bash
# Check backend logs
tail -f /var/log/ec2-dashboard-backend.log

# Test API directly
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"rule_key":"daily_start","cron_expression":"cron(30 3 ? * MON-SAT *)"}' \
  http://localhost:8000/api/schedule
```

### Lambda Not Triggering

**Check**:
1. Lambda targets are configured: `aws events list-targets-by-rule --rule gitlab-ec2-start-weekday`
2. Lambda has EventBridge permission
3. Rule is ENABLED
4. Cron expression is correct

**Fix**:
```bash
# Reconfigure targets
curl -X POST \
  -H "X-API-Key: YOUR_KEY" \
  http://localhost:8000/api/schedule/configure-targets
```

### Wrong Timezone

**Remember**: EventBridge uses UTC, not IST!

IST = UTC + 5:30

Example:
- Want: 9:00am IST
- Need: 3:30am UTC
- Cron: `cron(30 3 ? * MON-SAT *)`

## Dashboard UI

The dashboard provides two ways to manage schedules:

### 1. View Current Schedule (Schedule Card)

Shows:
- Current start time
- Current stop time
- Days of week
- Rule state (ENABLED/DISABLED)

### 2. Edit Schedule (Edit Schedule Card)

Allows:
- Change start time
- Change stop time
- Change days
- Apply changes (updates AWS immediately)

## Summary

✅ **YES** - Dashboard updates AWS EventBridge directly
✅ Changes take effect immediately
✅ Lambda targets are automatically reconfigured
✅ No manual AWS Console changes needed
✅ Full audit trail in AWS CloudTrail

When you change the schedule in the dashboard:
1. Frontend sends API request
2. Backend calls AWS EventBridge API
3. Rule is updated in AWS
4. Lambda target is reconfigured
5. New schedule is active

The dashboard is a **full management interface** for your EC2 scheduling automation!
