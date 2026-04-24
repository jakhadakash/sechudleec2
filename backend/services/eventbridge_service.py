import boto3
from backend.config import settings
from backend.services.audit_service import log_action

RULE_NAMES = {
    "daily_start": settings.EVENTBRIDGE_RULE_START,
    "daily_stop":  settings.EVENTBRIDGE_RULE_STOP,
}

# Map rule keys to their Lambda function ARNs
RULE_LAMBDA_TARGETS = {
    "daily_start": settings.LAMBDA_START_ARN,
    "daily_stop": settings.LAMBDA_STOP_ARN,
}

# Schedule: Mon–Sat 9:00am–9:00pm IST  |  Sunday fully off
# IST = UTC+5:30
# Start 9:00am IST = 03:30 UTC => cron(30 3 ? * MON-SAT *)
# Stop  9:00pm IST = 15:30 UTC => cron(30 15 ? * MON-SAT *)
DEFAULT_SCHEDULES = {
    "daily_start": "cron(30 3 ? * MON-SAT *)",
    "daily_stop":  "cron(30 15 ? * MON-SAT *)",
}


def _get_boto3_config():
    """Get boto3 client configuration with credentials if provided."""
    config = {"region_name": settings.AWS_REGION}
    
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    
    return config


def _client():
    return boto3.client("events", **_get_boto3_config())


def get_schedules() -> dict:
    events = _client()
    result = {}
    for key, name in RULE_NAMES.items():
        try:
            r = events.describe_rule(Name=name)
            result[key] = {
                "rule_name": name,
                "schedule": r.get("ScheduleExpression"),
                "state": r.get("State"),
                "description": r.get("Description", ""),
            }
        except events.exceptions.ResourceNotFoundException:
            result[key] = {"rule_name": name, "schedule": None, "state": "NOT_FOUND"}
        except Exception as e:
            result[key] = {"rule_name": name, "error": str(e)}
    return result


def update_schedule(rule_key: str, cron_expression: str) -> dict:
    if rule_key not in RULE_NAMES:
        raise ValueError(f"Unknown rule key '{rule_key}'. Valid: {list(RULE_NAMES)}")
    rule_name = RULE_NAMES[rule_key]
    events = _client()
    
    # Get old schedule for audit log
    try:
        old_rule = events.describe_rule(Name=rule_name)
        old_schedule = old_rule.get("ScheduleExpression", "N/A")
    except Exception:
        old_schedule = "N/A"
    
    # Update the rule schedule
    events.put_rule(
        Name=rule_name,
        ScheduleExpression=cron_expression,
        State="ENABLED",
    )
    
    # Configure Lambda target if ARN is provided
    lambda_arn = RULE_LAMBDA_TARGETS.get(rule_key)
    if lambda_arn:
        _configure_lambda_target(rule_name, lambda_arn)
    
    log_action(
        action="schedule_update",
        details={
            "rule_key": rule_key,
            "rule_name": rule_name,
            "old_schedule": old_schedule,
            "new_schedule": cron_expression,
            "lambda_arn": lambda_arn
        }
    )
    
    return {"rule_key": rule_key, "rule_name": rule_name, "updated_to": cron_expression}


def _configure_lambda_target(rule_name: str, lambda_arn: str) -> None:
    """
    Configure Lambda function as target for EventBridge rule.
    
    Args:
        rule_name: Name of the EventBridge rule
        lambda_arn: ARN of the Lambda function to invoke
    """
    if not lambda_arn:
        return
    
    events = _client()
    
    try:
        # Add Lambda as target for the rule
        events.put_targets(
            Rule=rule_name,
            Targets=[
                {
                    'Id': '1',
                    'Arn': lambda_arn,
                }
            ]
        )
        print(f"Configured Lambda target {lambda_arn} for rule {rule_name}")
    except Exception as e:
        print(f"Warning: Failed to configure Lambda target for {rule_name}: {str(e)}")
        # Don't raise - rule is still updated, just target configuration failed


def configure_all_lambda_targets() -> dict:
    """
    Configure Lambda targets for all EventBridge rules.
    Useful for initial setup or fixing missing targets.
    
    Returns:
        dict: Status of target configuration for each rule
    """
    events = _client()
    results = {}
    
    for rule_key, rule_name in RULE_NAMES.items():
        lambda_arn = RULE_LAMBDA_TARGETS.get(rule_key)
        
        if not lambda_arn:
            results[rule_key] = {
                "rule_name": rule_name,
                "status": "skipped",
                "message": "No Lambda ARN configured"
            }
            continue
        
        try:
            # Check if rule exists
            events.describe_rule(Name=rule_name)
            
            # Configure target
            _configure_lambda_target(rule_name, lambda_arn)
            
            results[rule_key] = {
                "rule_name": rule_name,
                "lambda_arn": lambda_arn,
                "status": "success",
                "message": "Lambda target configured"
            }
        except events.exceptions.ResourceNotFoundException:
            results[rule_key] = {
                "rule_name": rule_name,
                "status": "error",
                "message": "Rule not found - create rule first"
            }
        except Exception as e:
            results[rule_key] = {
                "rule_name": rule_name,
                "status": "error",
                "message": str(e)
            }
    
    return results
