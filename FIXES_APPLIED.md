# Fixes Applied - Disk Usage & Cost Display

## Issues Fixed

### 1. Disk Usage Showing 0

**Problem:** Disk usage card showed 0 because SSH connection was attempted even when instance was stopped.

**Solution:**
- Added instance state check before attempting SSH connection
- Only checks disk usage when instance is "running"
- Shows informative message when instance is stopped: "Instance is stopped - disk check only available when running"

**Files Modified:**
- `backend/services/disk_service.py` - Added EC2 state check before SSH

**Code Changes:**
```python
# Now checks instance state first
status = ec2_service.get_instance_status()
if status["state"] != "running":
    return {
        "status": "unavailable",
        "error": f"Instance is {status['state']} - disk check only available when running"
    }
```

### 2. Cost Card Enhancement

**Problem:** Cost card only showed projected monthly cost without comparison to 24/7 operation.

**Solution:**
- Added calculation for cost without scheduling (24/7 uptime)
- Shows potential monthly savings
- Displays cost reduction percentage (43%)
- Shows scheduling uptime percentage (57%)

**Files Modified:**
- `backend/services/cost_service.py` - Added scheduling calculations
- `frontend-react/src/api/types.ts` - Updated CostData interface
- `frontend-react/src/components/dashboard/CostCard.tsx` - Enhanced display

**New Fields Added:**
```typescript
interface CostData {
  projected_monthly_inr: number;                    // With scheduling
  projected_without_scheduling_inr: number;         // 24/7 cost
  potential_monthly_savings_inr: number;            // Savings amount
  scheduling_uptime_percent: number;                // 57%
  cost_reduction_percent: number;                   // 43%
}
```

**Display Changes:**
```
Before:
- Projected: ₹7,483
- Target: ₹1,600
- vs Target: +368%

After:
- Projected (with scheduling): ₹7,483
- Without scheduling (24/7): ₹13,128
- Monthly savings: ₹5,645 (43%)
- Target: ₹1,600
```

### 3. Disk Usage Card Error Handling

**Problem:** Error messages weren't displayed clearly when disk check failed.

**Solution:**
- Added separate handling for "unavailable" status (instance stopped)
- Shows informative blue info box when instance is not running
- Maintains existing warning/critical alerts for high disk usage

**Files Modified:**
- `frontend-react/src/api/types.ts` - Added 'unavailable' status
- `frontend-react/src/components/dashboard/DiskUsageCard.tsx` - Enhanced error display

## Testing

### Test Disk Usage

**When instance is stopped:**
```bash
# Backend will return:
{
  "status": "unavailable",
  "error": "Instance is stopped - disk check only available when running"
}

# Frontend will show blue info box with message
```

**When instance is running:**
```bash
# Backend attempts SSH connection and returns disk stats
{
  "total_gb": 100,
  "used_gb": 45,
  "available_gb": 55,
  "usage_percent": 45,
  "status": "ok"
}
```

### Test Cost Display

**API Response:**
```bash
curl -H "X-API-Key: YOUR_KEY" http://localhost:8000/api/cost

# Returns:
{
  "cost_inr": 248.33,
  "projected_monthly_inr": 7483,
  "projected_without_scheduling_inr": 13128,
  "potential_monthly_savings_inr": 5645,
  "scheduling_uptime_percent": 57,
  "cost_reduction_percent": 43
}
```

**Frontend Display:**
- Shows both costs side by side
- Highlights savings in green
- Shows 24/7 cost in red (what you'd pay without scheduling)

## Configuration

### Scheduling Parameters

Located in `backend/services/cost_service.py`:

```python
# Current schedule: ~96 hours off per week
SCHEDULING_UPTIME_PERCENT = 57      # 57% uptime
SCHEDULING_COST_REDUCTION_PERCENT = 43  # 43% savings
```

**To adjust for different schedules:**

| Schedule | Hours Off/Week | Uptime % | Savings % |
|----------|----------------|----------|-----------|
| Current (Mon-Sat 12h off + Sun off) | 96 | 57% | 43% |
| Weeknights only (Mon-Fri 12h off) | 60 | 64% | 36% |
| Weekends only (Sat-Sun off) | 48 | 71% | 29% |
| Nights only (Every day 8h off) | 56 | 67% | 33% |

Update the constants in `cost_service.py` to match your schedule.

## Benefits

### 1. Better User Experience
- ✅ No confusing "0 GB" disk usage when instance is stopped
- ✅ Clear message explaining why disk check isn't available
- ✅ Informative cost comparison showing actual savings

### 2. Accurate Cost Tracking
- ✅ Shows real savings from scheduling
- ✅ Helps justify the automation investment
- ✅ Makes cost reduction visible and measurable

### 3. Improved Monitoring
- ✅ Disk checks only when meaningful (instance running)
- ✅ Reduces unnecessary SSH connection attempts
- ✅ Better error messages for troubleshooting

## Restart Required

After applying these changes, restart the backend:

```bash
cd ec2-dashboard

# If using systemd
sudo systemctl restart ec2-dashboard-backend

# Or if running manually
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

For frontend (if using React dev server):

```bash
cd ec2-dashboard/frontend-react
npm run dev
```

## Verification

### 1. Check Disk Usage Card

**When instance is stopped:**
- Should show blue info box: "Instance is stopped - disk check only available when running"
- Ring and bar should be empty/gray
- Stats should show "—"

**When instance is running:**
- Should show actual disk usage
- Ring and bar should be colored (green/amber/red)
- Stats should show GB values

### 2. Check Cost Card

Should show 4 rows:
1. **Projected (with scheduling)** - Current projected cost (green if on track)
2. **Without scheduling (24/7)** - What you'd pay without automation (red)
3. **Monthly savings** - Difference + percentage (green)
4. **Target** - Your budget target (gray)

### 3. Test API Endpoints

```bash
# Test disk endpoint
curl -H "X-API-Key: YOUR_KEY" http://localhost:8000/api/disk

# Test cost endpoint
curl -H "X-API-Key: YOUR_KEY" http://localhost:8000/api/cost
```

## Future Enhancements

### Potential Improvements

1. **Dynamic Schedule Detection**
   - Auto-calculate uptime % from EventBridge rules
   - Update cost calculations based on actual schedule

2. **Historical Cost Tracking**
   - Store daily costs in database
   - Show month-over-month comparison
   - Track actual vs projected savings

3. **Disk Usage Trends**
   - Store disk usage history
   - Show growth rate
   - Predict when cleanup will be needed

4. **Smart Disk Checks**
   - Cache last disk reading
   - Only check every 5 minutes when running
   - Reduce SSH connection overhead

## Troubleshooting

### Disk Usage Still Shows 0

**Check:**
1. Instance is running: `aws ec2 describe-instances --instance-ids i-YOUR_ID`
2. SSH key path is correct in `.env`: `SSH_KEY_PATH=/home/ubuntu/.ssh/id_rsa`
3. GitLab host is correct: `GITLAB_HOST=mygitlab.idealittechno.in`
4. SSH key has correct permissions: `chmod 600 /home/ubuntu/.ssh/id_rsa`
5. Backend can reach GitLab host: `ssh ubuntu@mygitlab.idealittechno.in`

### Cost Calculations Seem Wrong

**Check:**
1. Cost Explorer is enabled in AWS Console
2. IAM user has `ce:GetCostAndUsage` permission
3. Scheduling constants match your actual schedule
4. Current month has enough data (wait 24 hours after enabling Cost Explorer)

### Frontend Not Updating

**Check:**
1. Backend restarted after code changes
2. Frontend rebuilt: `npm run build` or dev server restarted
3. Browser cache cleared (Ctrl+Shift+R)
4. API endpoints returning new fields: `curl http://localhost:8000/api/cost`

## Summary

These fixes improve the dashboard by:
- ✅ Only checking disk when instance is running
- ✅ Showing clear messages when checks aren't possible
- ✅ Displaying actual cost savings from scheduling
- ✅ Making the value of automation visible

The cost card now clearly shows you're saving ₹5,645/month (43%) by using automated scheduling instead of running 24/7!
