import boto3
from datetime import datetime, timezone, timedelta
from backend.config import settings
from backend.services.audit_service import log_action


def _get_boto3_config():
    """Get boto3 client configuration with credentials if provided."""
    config = {"region_name": settings.AWS_REGION}
    
    # Only add credentials if they are explicitly set in environment
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    # Otherwise, boto3 will use default credential chain (IAM role, ~/.aws/credentials, etc.)
    
    return config


def _ec2_client():
    return boto3.client("ec2", **_get_boto3_config())


def _cw_client():
    return boto3.client("cloudwatch", **_get_boto3_config())


def _ssm_client():
    return boto3.client("ssm", **_get_boto3_config())


def get_instance_status() -> dict:
    ec2 = _ec2_client()
    resp = ec2.describe_instances(InstanceIds=[settings.EC2_INSTANCE_ID])
    instance = resp["Reservations"][0]["Instances"][0]
    launch_time = instance.get("LaunchTime")
    uptime_hours = None
    if launch_time and instance["State"]["Name"] == "running":
        delta = datetime.now(timezone.utc) - launch_time
        uptime_hours = round(delta.total_seconds() / 3600, 1)

    return {
        "instance_id": instance["InstanceId"],
        "state": instance["State"]["Name"],
        "instance_type": instance["InstanceType"],
        "launch_time": launch_time.isoformat() if launch_time else None,
        "uptime_hours": uptime_hours,
        "public_ip": instance.get("PublicIpAddress", "N/A"),
        "cpu_credits": _get_cpu_credits(),
    }


def start_instance() -> dict:
    ec2 = _ec2_client()
    resp = ec2.start_instances(InstanceIds=[settings.EC2_INSTANCE_ID])
    state = resp["StartingInstances"][0]["CurrentState"]["Name"]
    
    log_action(
        action="instance_start",
        details={
            "instance_id": settings.EC2_INSTANCE_ID,
            "new_state": state
        }
    )
    
    return {"action": "start", "current_state": state}


def stop_instance() -> dict:
    _run_ssm_command("bash /opt/gitlab/scripts/graceful_shutdown.sh")
    ec2 = _ec2_client()
    resp = ec2.stop_instances(InstanceIds=[settings.EC2_INSTANCE_ID])
    state = resp["StoppingInstances"][0]["CurrentState"]["Name"]
    
    log_action(
        action="instance_stop",
        details={
            "instance_id": settings.EC2_INSTANCE_ID,
            "new_state": state,
            "graceful_shutdown": True
        }
    )
    
    return {"action": "stop", "current_state": state}


def _get_cpu_credits() -> float | None:
    try:
        cw = _cw_client()
        resp = cw.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="CPUCreditBalance",
            Dimensions=[{"Name": "InstanceId", "Value": settings.EC2_INSTANCE_ID}],
            Period=300,
            Statistics=["Average"],
            StartTime=datetime.utcnow() - timedelta(minutes=10),
            EndTime=datetime.utcnow(),
        )
        points = resp.get("Datapoints", [])
        if not points:
            return None
        points.sort(key=lambda p: p["Timestamp"])
        return round(points[-1]["Average"], 2)
    except Exception:
        return None


def _run_ssm_command(command: str) -> None:
    try:
        ssm = _ssm_client()
        ssm.send_command(
            InstanceIds=[settings.EC2_INSTANCE_ID],
            DocumentName="AWS-RunShellScript",
            Parameters={"commands": [command]},
        )
    except Exception:
        pass
