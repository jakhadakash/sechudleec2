# Quick Lambda Setup Guide

## 🚀 5-Minute Setup

### Prerequisites

Create an IAM user with appropriate permissions:

```bash
cd ec2-dashboard/infra
./create_iam_user.sh
```

Choose option 1 for development. See [IAM_USER_SETUP.md](infra/IAM_USER_SETUP.md) for details.

### Step 1: Deploy Lambda Functions

```bash
cd ec2-dashboard/infra
./deploy_lambdas.sh
```

The script will prompt you for:
- AWS Region (default: ap-south-1)
- EC2 Instance ID

### Step 2: Update Backend Configuration

Copy the Lambda ARNs from the deployment output and add to `backend/.env`:

```bash
LAMBDA_START_ARN=arn:aws:lambda:ap-south-1:ACCOUNT_ID:function:gitlab-ec2-start
LAMBDA_STOP_ARN=arn:aws:lambda:ap-south-1:ACCOUNT_ID:function:gitlab-ec2-stop
```

### Step 3: Restart Backend

```bash
cd ec2-dashboard
source backend/venv/bin/activate  # if using virtualenv
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 4: Test

```bash
# Test Lambda functions
aws lambda invoke --function-name gitlab-ec2-start --region ap-south-1 /tmp/start.json
aws lambda invoke --function-name gitlab-ec2-stop --region ap-south-1 /tmp/stop.json

# Verify EventBridge targets
aws events list-targets-by-rule --rule gitlab-ec2-start-weekday --region ap-south-1
aws events list-targets-by-rule --rule gitlab-ec2-stop-weekday --region ap-south-1
```

## ✅ What You Get

- ✅ Automated EC2 start/stop on schedule
- ✅ Graceful GitLab shutdown before stop
- ✅ Manual override via EC2 tags
- ✅ CloudWatch logging for all actions
- ✅ ~33% cost reduction (112.5 hrs/week off)

## 🏷️ Manual Override

Prevent automated actions when needed:

```bash
# Skip automated stop (useful during maintenance)
aws ec2 create-tags \
  --resources YOUR_INSTANCE_ID \
  --tags Key=no-auto-stop,Value=true \
  --region ap-south-1

# Remove override
aws ec2 delete-tags \
  --resources YOUR_INSTANCE_ID \
  --tags Key=no-auto-stop \
  --region ap-south-1
```

## 📊 Monitor

View Lambda execution logs:

```bash
# Real-time logs
aws logs tail /aws/lambda/gitlab-ec2-start --follow --region ap-south-1
aws logs tail /aws/lambda/gitlab-ec2-stop --follow --region ap-south-1
```

## � Updating EC2 Instance ID

If you need to change the EC2 instance ID later:

### Option 1: Quick Update Script (Recommended)

```bash
cd ec2-dashboard/infra
./update_lambda_instance.sh
```

This script will:
- Read EC2_INSTANCE_ID from your backend/.env
- Update both Lambda functions
- Prompt for confirmation

### Option 2: Manual Update

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

### Important Notes

⚠️ **Two Separate Configurations:**
- **Backend .env**: Used by dashboard API for manual start/stop buttons
- **Lambda environment**: Used by scheduled automated start/stop

When you change EC2_INSTANCE_ID:
1. Update `backend/.env` (for dashboard API)
2. Run `./update_lambda_instance.sh` (for Lambda functions)
3. Restart backend to load new .env

## 🔧 Troubleshooting

**Lambda doesn't execute?**
- Check EventBridge rule is ENABLED
- Verify Lambda targets are configured
- Check CloudWatch logs for errors

**Instance doesn't start/stop?**
- Verify EC2_INSTANCE_ID in Lambda environment
- Check Lambda IAM role has EC2 permissions
- Look for override tags (no-auto-start/stop)

**Need more help?**
- See `infra/LAMBDA_DEPLOYMENT.md` for detailed guide
- See `LAMBDA_INTEGRATION_SUMMARY.md` for architecture details

## 💰 Cost

Lambda execution: **< $0.01/month** (within free tier)

## 📅 Default Schedule

- **Start**: Mon-Sat 9:00am IST (3:30 UTC)
- **Stop**: Mon-Sat 9:00pm IST (15:30 UTC)
- **Sunday**: Fully off

Modify schedules via dashboard or EventBridge console.
