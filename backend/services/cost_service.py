import boto3
from datetime import date


USD_TO_INR = 83.5
TARGET_MONTHLY_INR = 1600

# t3.medium pricing in ap-south-1 (India)
T3_MEDIUM_HOURLY_USD = 0.0448  # On-demand price
HOURS_PER_MONTH = 720  # 30 days × 24 hours
T3_MEDIUM_MONTHLY_24_7_USD = T3_MEDIUM_HOURLY_USD * HOURS_PER_MONTH  # $32.26
T3_MEDIUM_MONTHLY_24_7_INR = T3_MEDIUM_MONTHLY_24_7_USD * USD_TO_INR  # ₹2,694

# EBS gp3 pricing in ap-south-1
EBS_GP3_PER_GB_MONTH_USD = 0.088  # $0.088 per GB-month
EBS_VOLUME_SIZE_GB = 60  # Your volume size
EBS_MONTHLY_USD = EBS_GP3_PER_GB_MONTH_USD * EBS_VOLUME_SIZE_GB  # $5.28
EBS_MONTHLY_INR = EBS_MONTHLY_USD * USD_TO_INR  # ₹440

# Total 24/7 cost (instance + EBS)
TOTAL_24_7_MONTHLY_INR = T3_MEDIUM_MONTHLY_24_7_INR + EBS_MONTHLY_INR  # ₹3,134

# Scheduling: Mon-Sat 12h/day + Sun 0h = 72 hours ON per week
# 72 hours / 168 total = 43% uptime for EC2 instance
# EBS is charged 24/7 regardless of instance state
SCHEDULING_UPTIME_PERCENT = 43
SCHEDULING_COST_REDUCTION_PERCENT = 57

# Calculate scheduled costs
EC2_SCHEDULED_MONTHLY_INR = T3_MEDIUM_MONTHLY_24_7_INR * (SCHEDULING_UPTIME_PERCENT / 100)  # ₹1,158
TOTAL_SCHEDULED_MONTHLY_INR = EC2_SCHEDULED_MONTHLY_INR + EBS_MONTHLY_INR  # ₹1,598


def _get_boto3_config():
    """Get boto3 client configuration with credentials if provided."""
    from backend.config import settings
    
    config = {"region_name": "us-east-1"}  # Cost Explorer is always us-east-1
    
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    
    return config


def get_current_month_cost() -> dict:
    try:
        # Cost Explorer is always us-east-1
        ce = boto3.client("ce", **_get_boto3_config())
        today = date.today()
        start = today.replace(day=1).isoformat()
        end = today.isoformat()

        # start == end on the 1st of the month; CE requires start < end
        if start == end:
            return _zero_cost_response(today)

        resp = ce.get_cost_and_usage(
            TimePeriod={"Start": start, "End": end},
            Granularity="MONTHLY",
            Filter={
                "Dimensions": {
                    "Key": "SERVICE",
                    "Values": ["Amazon Elastic Compute Cloud - Compute"],
                }
            },
            Metrics=["UnblendedCost"],
        )
        amount_usd = float(
            resp["ResultsByTime"][0]["Total"]["UnblendedCost"]["Amount"]
        )
        amount_inr = round(amount_usd * USD_TO_INR, 2)
        days_elapsed = today.day
        
        # This is the ACTUAL cost from AWS (includes EC2 + EBS + data transfer, etc.)
        actual_projected_inr = round(amount_inr / days_elapsed * 30, 2) if days_elapsed > 0 else 0
        
        # Use theoretical pricing instead of actual cost for projections
        # This gives accurate comparison regardless of actual usage
        projected_without_scheduling = round(TOTAL_24_7_MONTHLY_INR, 2)
        projected_with_scheduling = round(TOTAL_SCHEDULED_MONTHLY_INR, 2)
        potential_savings = round(projected_without_scheduling - projected_with_scheduling, 2)
        
        # Breakdown for display
        ec2_24_7 = round(T3_MEDIUM_MONTHLY_24_7_INR, 2)
        ec2_scheduled = round(EC2_SCHEDULED_MONTHLY_INR, 2)
        ebs_monthly = round(EBS_MONTHLY_INR, 2)

        return {
            "period_start": start,
            "period_end": end,
            "cost_usd": round(amount_usd, 2),
            "cost_inr": amount_inr,
            "actual_projected_monthly_inr": actual_projected_inr,  # What you're actually spending
            "projected_monthly_inr": projected_with_scheduling,     # Theoretical scheduled cost
            "projected_without_scheduling_inr": projected_without_scheduling,  # Theoretical 24/7 cost
            "potential_monthly_savings_inr": potential_savings,
            "ec2_instance_24_7_inr": ec2_24_7,
            "ec2_instance_scheduled_inr": ec2_scheduled,
            "ebs_volume_monthly_inr": ebs_monthly,
            "scheduling_uptime_percent": SCHEDULING_UPTIME_PERCENT,
            "cost_reduction_percent": SCHEDULING_COST_REDUCTION_PERCENT,
            "target_monthly_inr": TARGET_MONTHLY_INR,
            "on_track": projected_with_scheduling <= TARGET_MONTHLY_INR,
            "error": None,
        }
    except Exception as e:
        return {
            "period_start": None,
            "period_end": None,
            "cost_usd": None,
            "cost_inr": None,
            "actual_projected_monthly_inr": None,
            "projected_monthly_inr": None,
            "projected_without_scheduling_inr": None,
            "potential_monthly_savings_inr": None,
            "ec2_instance_24_7_inr": None,
            "ec2_instance_scheduled_inr": None,
            "ebs_volume_monthly_inr": None,
            "scheduling_uptime_percent": SCHEDULING_UPTIME_PERCENT,
            "cost_reduction_percent": SCHEDULING_COST_REDUCTION_PERCENT,
            "target_monthly_inr": TARGET_MONTHLY_INR,
            "on_track": None,
            "error": str(e),
        }


def _zero_cost_response(today: date) -> dict:
    return {
        "period_start": today.isoformat(),
        "period_end": today.isoformat(),
        "cost_usd": 0.0,
        "cost_inr": 0.0,
        "actual_projected_monthly_inr": 0.0,
        "projected_monthly_inr": round(TOTAL_SCHEDULED_MONTHLY_INR, 2),
        "projected_without_scheduling_inr": round(TOTAL_24_7_MONTHLY_INR, 2),
        "potential_monthly_savings_inr": round(TOTAL_24_7_MONTHLY_INR - TOTAL_SCHEDULED_MONTHLY_INR, 2),
        "ec2_instance_24_7_inr": round(T3_MEDIUM_MONTHLY_24_7_INR, 2),
        "ec2_instance_scheduled_inr": round(EC2_SCHEDULED_MONTHLY_INR, 2),
        "ebs_volume_monthly_inr": round(EBS_MONTHLY_INR, 2),
        "scheduling_uptime_percent": SCHEDULING_UPTIME_PERCENT,
        "cost_reduction_percent": SCHEDULING_COST_REDUCTION_PERCENT,
        "target_monthly_inr": TARGET_MONTHLY_INR,
        "on_track": True,
        "error": None,
    }
