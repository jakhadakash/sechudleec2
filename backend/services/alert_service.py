import boto3
from backend.config import settings


def _get_boto3_config():
    """Get boto3 client configuration with credentials if provided."""
    config = {"region_name": settings.AWS_REGION}
    
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    
    return config


def send_alert(subject: str, message: str) -> None:
    if not settings.SNS_TOPIC_ARN:
        return
    try:
        sns = boto3.client("sns", **_get_boto3_config())
        sns.publish(
            TopicArn=settings.SNS_TOPIC_ARN,
            Subject=f"[EC2 Dashboard] {subject}",
            Message=message,
        )
    except Exception:
        pass
