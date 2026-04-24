#!/usr/bin/env python3
"""
AWS Connection Diagnostic Script

This script tests connectivity to AWS services and helps identify credential issues.
Run this before starting the dashboard to verify AWS configuration.

Usage:
    python backend/test_aws_connection.py
"""

import sys
import boto3
from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError
from backend.config import settings


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_credentials():
    """Test if AWS credentials are configured."""
    print_section("1. Checking AWS Credentials")
    
    print(f"AWS_REGION: {settings.AWS_REGION}")
    print(f"AWS_ACCESS_KEY_ID: {'✓ Set' if settings.AWS_ACCESS_KEY_ID else '✗ Not set (will use default credential chain)'}")
    print(f"AWS_SECRET_ACCESS_KEY: {'✓ Set' if settings.AWS_SECRET_ACCESS_KEY else '✗ Not set (will use default credential chain)'}")
    
    # Try to get caller identity
    try:
        sts = boto3.client('sts', region_name=settings.AWS_REGION)
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            sts = boto3.client(
                'sts',
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
        
        identity = sts.get_caller_identity()
        print(f"\n✓ Successfully authenticated!")
        print(f"  Account: {identity['Account']}")
        print(f"  User ARN: {identity['Arn']}")
        print(f"  User ID: {identity['UserId']}")
        return True
    except NoCredentialsError:
        print("\n✗ ERROR: No credentials found!")
        print("  Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env")
        print("  OR configure ~/.aws/credentials")
        print("  OR use an IAM instance profile if running on EC2")
        return False
    except PartialCredentialsError:
        print("\n✗ ERROR: Incomplete credentials!")
        print("  Both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set")
        return False
    except ClientError as e:
        print(f"\n✗ ERROR: {e}")
        print("  Check if your credentials are valid and have the correct permissions")
        return False


def test_ec2_access():
    """Test EC2 API access."""
    print_section("2. Testing EC2 Access")
    
    print(f"EC2_INSTANCE_ID: {settings.EC2_INSTANCE_ID}")
    
    if settings.EC2_INSTANCE_ID == "i-0xxxxxxxxxxxxxxx":
        print("\n⚠ WARNING: EC2_INSTANCE_ID is still a placeholder!")
        print("  Please update EC2_INSTANCE_ID in .env with your actual instance ID")
        return False
    
    try:
        config = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        
        ec2 = boto3.client("ec2", **config)
        response = ec2.describe_instances(InstanceIds=[settings.EC2_INSTANCE_ID])
        
        instance = response['Reservations'][0]['Instances'][0]
        print(f"\n✓ Successfully connected to EC2!")
        print(f"  Instance ID: {instance['InstanceId']}")
        print(f"  Instance Type: {instance['InstanceType']}")
        print(f"  State: {instance['State']['Name']}")
        print(f"  Public IP: {instance.get('PublicIpAddress', 'N/A')}")
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'InvalidInstanceID.NotFound':
            print(f"\n✗ ERROR: Instance {settings.EC2_INSTANCE_ID} not found!")
            print("  Check if the instance ID is correct and exists in your AWS account")
        elif error_code == 'UnauthorizedOperation':
            print(f"\n✗ ERROR: Not authorized to describe EC2 instances!")
            print("  Your IAM user/role needs 'ec2:DescribeInstances' permission")
        else:
            print(f"\n✗ ERROR: {e}")
        return False
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        return False


def test_eventbridge_access():
    """Test EventBridge API access."""
    print_section("3. Testing EventBridge Access")
    
    print(f"EVENTBRIDGE_RULE_START: {settings.EVENTBRIDGE_RULE_START}")
    print(f"EVENTBRIDGE_RULE_STOP: {settings.EVENTBRIDGE_RULE_STOP}")
    
    try:
        config = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        
        events = boto3.client("events", **config)
        
        # Try to describe the start rule
        try:
            rule = events.describe_rule(Name=settings.EVENTBRIDGE_RULE_START)
            print(f"\n✓ Found EventBridge rule: {settings.EVENTBRIDGE_RULE_START}")
            print(f"  Schedule: {rule.get('ScheduleExpression', 'N/A')}")
            print(f"  State: {rule.get('State', 'N/A')}")
        except events.exceptions.ResourceNotFoundException:
            print(f"\n⚠ WARNING: EventBridge rule '{settings.EVENTBRIDGE_RULE_START}' not found")
            print("  You need to create EventBridge rules for scheduling")
            print("  See: ec2-dashboard/infra/eventbridge_rules.json")
        
        print(f"\n✓ Successfully connected to EventBridge!")
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UnauthorizedOperation' or error_code == 'AccessDeniedException':
            print(f"\n✗ ERROR: Not authorized to access EventBridge!")
            print("  Your IAM user/role needs 'events:DescribeRule' permission")
        else:
            print(f"\n✗ ERROR: {e}")
        return False
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        return False


def test_cloudwatch_access():
    """Test CloudWatch API access."""
    print_section("4. Testing CloudWatch Access")
    
    try:
        config = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        
        cw = boto3.client("cloudwatch", **config)
        
        # Try to list metrics (lightweight operation)
        response = cw.list_metrics(
            Namespace='AWS/EC2',
            MetricName='CPUCreditBalance',
            Dimensions=[{'Name': 'InstanceId', 'Value': settings.EC2_INSTANCE_ID}]
        )
        
        print(f"\n✓ Successfully connected to CloudWatch!")
        if response['Metrics']:
            print(f"  Found CPU credit metrics for instance")
        else:
            print(f"  No CPU credit metrics found (instance may not be burstable type)")
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UnauthorizedOperation' or error_code == 'AccessDeniedException':
            print(f"\n✗ ERROR: Not authorized to access CloudWatch!")
            print("  Your IAM user/role needs 'cloudwatch:ListMetrics' permission")
        else:
            print(f"\n✗ ERROR: {e}")
        return False
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        return False


def test_cost_explorer_access():
    """Test Cost Explorer API access."""
    print_section("5. Testing Cost Explorer Access")
    
    try:
        config = {"region_name": "us-east-1"}  # Cost Explorer is always us-east-1
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        
        ce = boto3.client("ce", **config)
        
        # Try a simple cost query
        from datetime import date
        today = date.today()
        start = today.replace(day=1).isoformat()
        
        response = ce.get_cost_and_usage(
            TimePeriod={'Start': start, 'End': today.isoformat()},
            Granularity='MONTHLY',
            Metrics=['UnblendedCost']
        )
        
        print(f"\n✓ Successfully connected to Cost Explorer!")
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'AccessDeniedException':
            print(f"\n✗ ERROR: Not authorized to access Cost Explorer!")
            print("  Your IAM user/role needs 'ce:GetCostAndUsage' permission")
            print("  Note: Cost Explorer may need to be enabled in your AWS account")
        else:
            print(f"\n✗ ERROR: {e}")
        return False
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        return False


def test_sns_access():
    """Test SNS API access."""
    print_section("6. Testing SNS Access")
    
    print(f"SNS_TOPIC_ARN: {settings.SNS_TOPIC_ARN}")
    
    if not settings.SNS_TOPIC_ARN or "ACCOUNT" in settings.SNS_TOPIC_ARN:
        print("\n⚠ WARNING: SNS_TOPIC_ARN is not configured or is a placeholder")
        print("  Alerts will be disabled until you create an SNS topic")
        return True  # Not a failure, just not configured
    
    try:
        config = {"region_name": settings.AWS_REGION}
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            config["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
            config["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
        
        sns = boto3.client("sns", **config)
        
        # Try to get topic attributes
        response = sns.get_topic_attributes(TopicArn=settings.SNS_TOPIC_ARN)
        
        print(f"\n✓ Successfully connected to SNS!")
        print(f"  Topic: {response['Attributes'].get('DisplayName', 'N/A')}")
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'NotFound':
            print(f"\n✗ ERROR: SNS topic not found!")
            print("  Check if the topic ARN is correct")
        elif error_code == 'AuthorizationError' or error_code == 'AccessDeniedException':
            print(f"\n✗ ERROR: Not authorized to access SNS!")
            print("  Your IAM user/role needs 'sns:GetTopicAttributes' permission")
        else:
            print(f"\n✗ ERROR: {e}")
        return False
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        return False


def print_summary(results):
    """Print test summary."""
    print_section("Test Summary")
    
    total = len(results)
    passed = sum(1 for r in results.values() if r)
    
    for test_name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status}  {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Your AWS configuration is correct.")
        print("   You can now start the dashboard backend.")
    else:
        print("\n⚠ Some tests failed. Please fix the issues above before starting the dashboard.")
        print("\nCommon fixes:")
        print("  1. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env")
        print("  2. Update EC2_INSTANCE_ID with your actual instance ID")
        print("  3. Create EventBridge rules (see infra/eventbridge_rules.json)")
        print("  4. Create SNS topic for alerts (optional)")
        print("  5. Ensure your IAM user/role has required permissions (see infra/iam_policy.json)")


def main():
    print("\n" + "="*60)
    print("  AWS Connection Diagnostic Tool")
    print("  EC2 Scheduler Dashboard")
    print("="*60)
    
    results = {
        "Credentials": test_credentials(),
        "EC2 Access": test_ec2_access(),
        "EventBridge Access": test_eventbridge_access(),
        "CloudWatch Access": test_cloudwatch_access(),
        "Cost Explorer Access": test_cost_explorer_access(),
        "SNS Access": test_sns_access(),
    }
    
    print_summary(results)
    
    # Exit with error code if any test failed
    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
