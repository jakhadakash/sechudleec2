# Lambda Function Deployment Guide

This guide explains how to deploy the Lambda functions that EventBridge uses to automatically start/stop your EC2 instance.

## Overview

The EC2 Scheduler uses two Lambda functions:
- **gitlab-ec2-start** - Starts the EC2 instance (triggered by start schedule)
- **gitlab-ec2-stop** - Stops the EC2 instance with graceful shutdown (triggered by stop schedule)

## Prerequisites

- AWS CLI configured with appropriate credentials
- IAM permissions to create Lambda functions and IAM roles
- Your EC2 instance ID
- EventBridge rules already created (see AWS_SETUP_GUIDE.md)

## Step 1: Create Lambda Execution Role

Create an IAM role that allows Lambda to manage EC2 and use SSM:

```bash
# Create trust policy for Lambda
cat > /tmp/lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name GitLabEC2SchedulerLambdaRole \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json

# Attach AWS managed policy for basic Lambda execution
aws iam attach-role-policy \
  --role-name GitLabEC2SchedulerLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for EC2 and SSM access
cat > /tmp/lambda-ec2-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create and attach the custom policy
aws iam create-policy \
  --policy-name GitLabEC2SchedulerLambdaPolicy \
  --policy-document file:///tmp/lambda-ec2-policy.json

# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Attach the custom policy
aws iam attach-role-policy \
  --role-name GitLabEC2SchedulerLambdaRole \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/GitLabEC2SchedulerLambdaPolicy
```

## Step 2: Package Lambda Functions

```bash
cd ec2-dashboard/infra

# Create deployment packages
zip lambda_ec2_start.zip lambda_ec2_start.py
zip lambda_ec2_stop.zip lambda_ec2_stop.py
```

## Step 3: Deploy Lambda Functions

Replace `YOUR_INSTANCE_ID` with your actual EC2 instance ID:

```bash
# Get your AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="ap-south-1"  # Change to your region
EC2_INSTANCE_ID="i-0123456789abcdef0"  # Change to your instance ID

# Deploy START Lambda
aws lambda create-function \
  --function-name gitlab-ec2-start \
  --runtime python3.11 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/GitLabEC2SchedulerLambdaRole \
  --handler lambda_ec2_start.lambda_handler \
  --zip-file fileb://lambda_ec2_start.zip \
  --timeout 30 \
  --memory-size 128 \
  --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID}}" \
  --region ${AWS_REGION}

# Deploy STOP Lambda
aws lambda create-function \
  --function-name gitlab-ec2-stop \
  --runtime python3.11 \
  --role arn:aws:iam::${ACCOUNT_ID}:role/GitLabEC2SchedulerLambdaRole \
  --handler lambda_ec2_stop.lambda_handler \
  --zip-file fileb://lambda_ec2_stop.zip \
  --timeout 60 \
  --memory-size 128 \
  --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID},GRACEFUL_SHUTDOWN_SCRIPT=bash /opt/gitlab/scripts/graceful_shutdown.sh}" \
  --region ${AWS_REGION}
```

## Step 4: Grant EventBridge Permission to Invoke Lambda

```bash
# Allow EventBridge to invoke START Lambda
aws lambda add-permission \
  --function-name gitlab-ec2-start \
  --statement-id AllowEventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:${AWS_REGION}:${ACCOUNT_ID}:rule/gitlab-ec2-start-weekday \
  --region ${AWS_REGION}

# Allow EventBridge to invoke STOP Lambda
aws lambda add-permission \
  --function-name gitlab-ec2-stop \
  --statement-id AllowEventBridgeInvoke \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:${AWS_REGION}:${ACCOUNT_ID}:rule/gitlab-ec2-stop-weekday \
  --region ${AWS_REGION}
```

## Step 5: Configure Lambda ARNs in Backend

Update your `backend/.env` file with the Lambda ARNs:

```bash
LAMBDA_START_ARN=arn:aws:lambda:ap-south-1:${ACCOUNT_ID}:function:gitlab-ec2-start
LAMBDA_STOP_ARN=arn:aws:lambda:ap-south-1:${ACCOUNT_ID}:function:gitlab-ec2-stop
```

## Step 6: Configure EventBridge Targets

You can configure targets either via API or AWS CLI:

### Option A: Using the Dashboard API

```bash
# Restart your backend to load new Lambda ARNs
# Then call the configure-targets endpoint
curl -X POST \
  -H "X-API-Key: your-api-key" \
  http://localhost:8000/api/schedule/configure-targets
```

### Option B: Using AWS CLI

```bash
# Add START Lambda as target for start rule
aws events put-targets \
  --rule gitlab-ec2-start-weekday \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-start" \
  --region ${AWS_REGION}

# Add STOP Lambda as target for stop rule
aws events put-targets \
  --rule gitlab-ec2-stop-weekday \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-stop" \
  --region ${AWS_REGION}
```

## Step 7: Test Lambda Functions

Test the Lambda functions manually before relying on scheduled execution:

```bash
# Test START Lambda
aws lambda invoke \
  --function-name gitlab-ec2-start \
  --region ${AWS_REGION} \
  /tmp/start-response.json

cat /tmp/start-response.json

# Test STOP Lambda
aws lambda invoke \
  --function-name gitlab-ec2-stop \
  --region ${AWS_REGION} \
  /tmp/stop-response.json

cat /tmp/stop-response.json
```

## Step 8: Verify EventBridge Integration

Check that targets are properly configured:

```bash
# List targets for start rule
aws events list-targets-by-rule \
  --rule gitlab-ec2-start-weekday \
  --region ${AWS_REGION}

# List targets for stop rule
aws events list-targets-by-rule \
  --rule gitlab-ec2-stop-weekday \
  --region ${AWS_REGION}
```

## Updating Lambda Functions

If you need to update the Lambda code:

```bash
cd ec2-dashboard/infra

# Repackage
zip lambda_ec2_start.zip lambda_ec2_start.py
zip lambda_ec2_stop.zip lambda_ec2_stop.py

# Update functions
aws lambda update-function-code \
  --function-name gitlab-ec2-start \
  --zip-file fileb://lambda_ec2_start.zip \
  --region ${AWS_REGION}

aws lambda update-function-code \
  --function-name gitlab-ec2-stop \
  --zip-file fileb://lambda_ec2_stop.zip \
  --region ${AWS_REGION}
```

### Updating EC2 Instance ID

If you need to change the target EC2 instance:

**Option 1: Use the update script (Recommended)**

```bash
cd ec2-dashboard/infra
./update_lambda_instance.sh
```

The script will read the EC2_INSTANCE_ID from your `backend/.env` file and update both Lambda functions automatically.

**Option 2: Manual update**

```bash
# Update START Lambda
aws lambda update-function-configuration \
  --function-name gitlab-ec2-start \
  --environment Variables="{EC2_INSTANCE_ID=i-NEW_INSTANCE_ID}" \
  --region ap-south-1

# Update STOP Lambda
aws lambda update-function-configuration \
  --function-name gitlab-ec2-stop \
  --environment Variables="{EC2_INSTANCE_ID=i-NEW_INSTANCE_ID,GRACEFUL_SHUTDOWN_SCRIPT=bash /opt/gitlab/scripts/graceful_shutdown.sh}" \
  --region ap-south-1
```

**Important:** Remember to also update `backend/.env` with the new instance ID and restart your backend service.

## Manual Override Tags

The Lambda functions support manual override tags to prevent automated actions:

- **no-auto-stop=true** - Prevents automated stop (useful for maintenance)
- **no-auto-start=true** - Prevents automated start

To add a tag:

```bash
aws ec2 create-tags \
  --resources ${EC2_INSTANCE_ID} \
  --tags Key=no-auto-stop,Value=true \
  --region ${AWS_REGION}
```

To remove a tag:

```bash
aws ec2 delete-tags \
  --resources ${EC2_INSTANCE_ID} \
  --tags Key=no-auto-stop \
  --region ${AWS_REGION}
```

## Monitoring Lambda Execution

View Lambda logs in CloudWatch:

```bash
# View START Lambda logs
aws logs tail /aws/lambda/gitlab-ec2-start --follow --region ${AWS_REGION}

# View STOP Lambda logs
aws logs tail /aws/lambda/gitlab-ec2-stop --follow --region ${AWS_REGION}
```

## Troubleshooting

### Lambda execution fails with "AccessDenied"

- Verify the IAM role has correct permissions
- Check that the role trust policy allows Lambda service

### EventBridge doesn't trigger Lambda

- Verify Lambda permission allows EventBridge to invoke
- Check EventBridge rule is ENABLED
- Verify targets are configured correctly

### Graceful shutdown doesn't execute

- Verify SSM agent is running on EC2 instance
- Check IAM role has ssm:SendCommand permission
- Verify shutdown script exists at `/opt/gitlab/scripts/graceful_shutdown.sh`

### Instance doesn't stop/start

- Check Lambda CloudWatch logs for errors
- Verify EC2_INSTANCE_ID environment variable is correct
- Ensure Lambda role has ec2:StartInstances and ec2:StopInstances permissions

## Cost Considerations

Lambda costs for this setup are minimal:
- **Invocations**: 2 per day (start + stop) = ~60/month
- **Duration**: ~1-2 seconds per invocation
- **Memory**: 128 MB

Expected cost: **< $0.01/month** (well within free tier)

## Security Best Practices

1. Use least-privilege IAM policies
2. Enable CloudTrail logging for Lambda invocations
3. Use VPC endpoints if Lambda needs to access private resources
4. Regularly review CloudWatch logs for anomalies
5. Use AWS Secrets Manager for sensitive configuration (if needed)

## Quick Reference

### Lambda Function Names
- `gitlab-ec2-start` - Starts EC2 instance
- `gitlab-ec2-stop` - Stops EC2 instance with graceful shutdown

### IAM Role
- `GitLabEC2SchedulerLambdaRole` - Execution role for both functions

### Environment Variables
- `EC2_INSTANCE_ID` - Target instance ID (both functions)
- `GRACEFUL_SHUTDOWN_SCRIPT` - Shutdown script path (stop function only)

### Manual Override Tags
- `no-auto-stop=true` - Skip automated stop
- `no-auto-start=true` - Skip automated start
