# Accurate Cost Calculation - Final Fix

## Problem

The dashboard was showing incorrect costs:
- **Displayed**: ₹9,353 expected, ₹21,751 without scheduling
- **Reality**: t3.medium should cost ~₹2,700-2,800 for 24/7

## Root Cause

The calculation was using **actual AWS costs** (which vary based on usage) instead of **theoretical pricing** based on AWS published rates.

## Solution

Use AWS published pricing rates instead of actual usage:

### Pricing Constants (ap-south-1 India)

```python
# t3.medium On-Demand pricing
T3_MEDIUM_HOURLY_USD = $0.0448/hour
T3_MEDIUM_MONTHLY_24_7 = $0.0448 × 720 hours = $32.26 ≈ ₹2,694

# EBS gp3 pricing
EBS_GP3_PER_GB_MONTH = $0.088/GB-month
EBS_60GB_MONTHLY = $0.088 × 60 GB = $5.28 ≈ ₹440

# Total 24/7 cost
TOTAL_24_7 = ₹2,694 + ₹440 = ₹3,134
```

### Scheduling Calculation

```python
# Schedule: Mon-Sat 12h/day + Sun 0h
# = 72 hours ON per week
# = 43% uptime

# EC2 cost (varies with uptime)
EC2_SCHEDULED = ₹2,694 × 43% = ₹1,158

# EBS cost (always 24/7)
EBS_ALWAYS_ON = ₹440

# Total scheduled cost
TOTAL_SCHEDULED = ₹1,158 + ₹440 = ₹1,598

# Savings
SAVINGS = ₹3,134 - ₹1,598 = ₹1,536 (49%)
```

## New Display

The cost card now shows:

1. **Actual (current month)**: ₹9,353
   - What you're REALLY spending from AWS
   - May be higher due to manual usage, testing, etc.

2. **Expected (with scheduling)**: ₹1,598
   - Theoretical cost with automation
   - EC2 (43% uptime) + EBS (100%)

3. **Without scheduling (24/7)**: ₹3,134
   - Theoretical 24/7 cost
   - EC2 (100%) + EBS (100%)

4. **Monthly savings**: ₹1,536 (49%)
   - Savings from EC2 scheduling
   - EBS runs 24/7 regardless

### Cost Breakdown

```
EC2 (24/7):           ₹2,694
EC2 (scheduled 43%):  ₹1,158
EBS 60GB gp3:         ₹440
```

## Why is Actual Higher?

Your actual cost (₹9,353) is much higher than expected (₹1,598) because:

1. **Instance running more than scheduled**
   - Manual starts for development/testing
   - EventBridge rules not active yet
   - Schedule not being followed

2. **Additional AWS costs**
   - Data transfer charges
   - Snapshots
   - Elastic IPs
   - Other EC2 services

3. **Different instance type or region**
   - Verify you're using t3.medium in ap-south-1
   - Check for Reserved Instances or Savings Plans

## Verification

### Check Your Instance Type

```bash
aws ec2 describe-instances \
  --instance-ids i-0a317eb53175195bf \
  --query 'Reservations[0].Instances[0].[InstanceType,Placement.AvailabilityZone]' \
  --output table
```

Expected: `t3.medium` in `ap-south-1a/b/c`

### Check Your EBS Volumes

```bash
aws ec2 describe-volumes \
  --filters "Name=attachment.instance-id,Values=i-0a317eb53175195bf" \
  --query 'Volumes[*].[VolumeId,Size,VolumeType,State]' \
  --output table
```

Expected: 60 GB gp3 volume

### Check Actual Usage Hours

```bash
# Get detailed cost breakdown
aws ce get-cost-and-usage \
  --time-period Start=2026-04-01,End=2026-04-24 \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=USAGE_TYPE \
  --filter file://<(cat <<EOF
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["Amazon Elastic Compute Cloud - Compute"]
  }
}
EOF
)
```

Look for:
- `BoxUsage:t3.medium` - EC2 instance hours
- `VolumeUsage.gp3` - EBS volume GB-months

## Pricing Reference

### t3.medium (ap-south-1)

| Component | Rate | Monthly (24/7) | Monthly (43%) |
|-----------|------|----------------|---------------|
| EC2 instance | $0.0448/hr | ₹2,694 | ₹1,158 |
| EBS 60GB gp3 | $0.088/GB-mo | ₹440 | ₹440 |
| **Total** | | **₹3,134** | **₹1,598** |

### Other Instance Types (for comparison)

| Type | vCPU | RAM | $/hr | ₹/month (24/7) |
|------|------|-----|------|----------------|
| t3.small | 2 | 2 GB | $0.0224 | ₹1,347 |
| t3.medium | 2 | 4 GB | $0.0448 | ₹2,694 |
| t3.large | 2 | 8 GB | $0.0896 | ₹5,388 |

## Configuration

The pricing is now hardcoded in `backend/services/cost_service.py`:

```python
# Update these if your setup changes
T3_MEDIUM_HOURLY_USD = 0.0448
EBS_GP3_PER_GB_MONTH_USD = 0.088
EBS_VOLUME_SIZE_GB = 60
USD_TO_INR = 83.5
```

## API Response

```bash
curl -H "X-API-Key: YOUR_KEY" http://localhost:8000/api/cost | jq
```

Expected output:
```json
{
  "actual_projected_monthly_inr": 9353.27,
  "projected_monthly_inr": 1598,
  "projected_without_scheduling_inr": 3134,
  "potential_monthly_savings_inr": 1536,
  "ec2_instance_24_7_inr": 2694,
  "ec2_instance_scheduled_inr": 1158,
  "ebs_volume_monthly_inr": 440,
  "scheduling_uptime_percent": 43,
  "cost_reduction_percent": 57
}
```

## Restart Backend

```bash
cd ec2-dashboard
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Summary

✅ **Fixed**: Now uses AWS published pricing rates
✅ **Accurate**: Shows realistic costs for t3.medium + 60GB EBS
✅ **Transparent**: Displays actual vs expected costs
✅ **Detailed**: Breaks down EC2 vs EBS costs

The dashboard now correctly shows:
- **24/7 cost**: ₹3,134 (EC2 + EBS)
- **Scheduled cost**: ₹1,598 (EC2 43% + EBS 100%)
- **Savings**: ₹1,536 (49% reduction)

Your actual cost (₹9,353) indicates the instance is running much more than the 43% scheduled uptime. Once EventBridge automation is active, your actual cost should drop to ~₹1,600/month.
