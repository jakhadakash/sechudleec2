# Lambda Integration Summary

## What Was Added

This update adds Lambda function integration to EventBridge rules, enabling automated EC2 instance start/stop scheduling.

### New Files Created

1. **infra/lambda_ec2_start.py** - Lambda function to start EC2 instance
   - Checks instance state before starting
   - Supports `no-auto-start` tag for manual override
   - Logs all actions to CloudWatch

2. **infra/lambda_ec2_stop.py** - Lambda function to stop EC2 instance
   - Executes graceful shutdown script via SSM
   - Supports `no-auto-stop` tag for manual override
   - Waits 10 seconds for graceful shutdown before stopping
   - Logs all actions to CloudWatch

3. **infra/deploy_lambdas.sh** - Automated deployment script
   - Creates IAM role with required permissions
   - Deploys both Lambda functions
   - Configures EventBridge permissions
   - Sets up EventBridge targets

4. **infra/LAMBDA_DEPLOYMENT.md** - Comprehensive deployment guide
   - Step-by-step manual deployment instructions
   - Troubleshooting tips
   - Security best practices
   - Cost estimates

5. **LAMBDA_INTEGRATION_SUMMARY.md** - This file

### Modified Files

1. **backend/config.py**
   - Added `LAMBDA_START_ARN` configuration
   - Added `LAMBDA_STOP_ARN` configuration

2. **backend/services/eventbridge_service.py**
   - Added `RULE_LAMBDA_TARGETS` mapping
   - Added `_configure_lambda_target()` function
   - Added `configure_all_lambda_targets()` function
   - Updated `update_schedule()` to configure targets automatically

3. **backend/routers/schedule.py**
   - Added `POST /api/schedule/configure-targets` endpoint
   - Allows manual trigger of Lambda target configuration

4. **infra/iam_policy.json**
   - Added `events:PutTargets` permission
   - Added `events:RemoveTargets` permission
   - Added `events:ListTargetsByRule` permission
   - Added `lambda:InvokeFunction` permission
   - Added `lambda:GetFunction` permission

5. **.env.example**
   - Added `LAMBDA_START_ARN` example
   - Added `LAMBDA_STOP_ARN` example

## How It Works

### Architecture Flow

```
EventBridge Rule (cron schedule)
    ↓
Lambda Function (gitlab-ec2-start or gitlab-ec2-stop)
    ↓
Check EC2 Tags (no-auto-start / no-auto-stop)
    ↓
[If STOP] Execute SSM Graceful Shutdown Script
    ↓
EC2 API (StartInstances / StopInstances)
    ↓
CloudWatch Logs (execution logs)
```

### Lambda Functions

**gitlab-ec2-start**
- Triggered by: `gitlab-ec2-start-weekday` EventBridge rule
- Schedule: Mon-Sat 9:00am IST (3:30 UTC)
- Actions:
  1. Describe instance to get current state
  2. Check for `no-auto-start=true` tag
  3. If stopped, call `ec2.start_instances()`
  4. Log result to CloudWatch

**gitlab-ec2-stop**
- Triggered by: `gitlab-ec2-stop-weekday` EventBridge rule
- Schedule: Mon-Sat 9:00pm IST (15:30 UTC)
- Actions:
  1. Describe instance to get current state
  2. Check for `no-auto-stop=true` tag
  3. If running, execute graceful shutdown via SSM
  4. Wait 10 seconds for shutdown to complete
  5. Call `ec2.stop_instances()`
  6. Log result to CloudWatch

### Manual Override Tags

You can prevent automated actions by adding EC2 tags:

```bash
# Prevent automated stop (useful during maintenance)
aws ec2 create-tags \
  --resources i-0123456789abcdef0 \
  --tags Key=no-auto-stop,Value=true

# Prevent automated start
aws ec2 create-tags \
  --resources i-0123456789abcdef0 \
  --tags Key=no-auto-start,Value=true

# Remove override
aws ec2 delete-tags \
  --resources i-0123456789abcdef0 \
  --tags Key=no-auto-stop
```

## Deployment Options

### Option 1: Quick Deployment (Recommended)

Use the automated deployment script:

```bash
cd ec2-dashboard/infra
./deploy_lambdas.sh
```

This script will:
- Create IAM role and policies
- Package and deploy Lambda functions
- Configure EventBridge permissions
- Set up EventBridge targets
- Display Lambda ARNs for your .env file

### Option 2: Manual Deployment

Follow the detailed guide in `infra/LAMBDA_DEPLOYMENT.md` for step-by-step manual deployment.

### Option 3: Infrastructure as Code

Use Terraform or CloudFormation (templates not included, but Lambda code is ready).

## Configuration

After deploying Lambda functions, update your `backend/.env`:

```bash
# Lambda ARNs (get from deployment output)
LAMBDA_START_ARN=arn:aws:lambda:ap-south-1:123456789012:function:gitlab-ec2-start
LAMBDA_STOP_ARN=arn:aws:lambda:ap-south-1:123456789012:function:gitlab-ec2-stop
```

Then restart your backend:

```bash
cd ec2-dashboard
source backend/venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Updating EC2 Instance ID

The EC2 instance ID is stored in two places:

1. **Backend .env** - Used by dashboard API for manual start/stop
2. **Lambda environment variables** - Used by scheduled automated start/stop

When you need to change the instance ID:

```bash
# 1. Update backend/.env
EC2_INSTANCE_ID=i-NEW_INSTANCE_ID

# 2. Update Lambda functions
cd ec2-dashboard/infra
./update_lambda_instance.sh

# 3. Restart backend
cd ec2-dashboard
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

The `update_lambda_instance.sh` script will automatically read the instance ID from your `.env` file and update both Lambda functions.

## Testing

### Test Lambda Functions Directly

```bash
# Test START function
aws lambda invoke \
  --function-name gitlab-ec2-start \
  --region ap-south-1 \
  /tmp/start-response.json

cat /tmp/start-response.json

# Test STOP function
aws lambda invoke \
  --function-name gitlab-ec2-stop \
  --region ap-south-1 \
  /tmp/stop-response.json

cat /tmp/stop-response.json
```

### Test EventBridge Integration

```bash
# Verify targets are configured
aws events list-targets-by-rule \
  --rule gitlab-ec2-start-weekday \
  --region ap-south-1

aws events list-targets-by-rule \
  --rule gitlab-ec2-stop-weekday \
  --region ap-south-1
```

### Test via Dashboard API

```bash
# Configure targets via API
curl -X POST \
  -H "X-API-Key: your-api-key" \
  http://localhost:8000/api/schedule/configure-targets
```

## Monitoring

### CloudWatch Logs

Lambda execution logs are automatically sent to CloudWatch:

```bash
# View START Lambda logs
aws logs tail /aws/lambda/gitlab-ec2-start --follow

# View STOP Lambda logs
aws logs tail /aws/lambda/gitlab-ec2-stop --follow
```

### EventBridge Metrics

Monitor EventBridge rule invocations in CloudWatch Metrics:
- Namespace: `AWS/Events`
- Metrics: `Invocations`, `FailedInvocations`, `TriggeredRules`

## Cost Impact

Lambda costs for this setup are minimal:

- **Invocations**: 2/day × 30 days = 60/month
- **Duration**: ~1-2 seconds per invocation
- **Memory**: 128 MB
- **Estimated cost**: < $0.01/month (within free tier)

Free tier includes:
- 1M requests/month
- 400,000 GB-seconds compute time/month

## Security Considerations

1. **IAM Permissions**: Lambda functions use least-privilege IAM role
2. **CloudWatch Logging**: All executions logged for audit trail
3. **Manual Override**: Tags provide emergency override capability
4. **No Hardcoded Credentials**: Uses IAM role, not access keys
5. **Regional Isolation**: Functions deployed in same region as EC2

## Troubleshooting

### Lambda doesn't execute on schedule

**Check:**
1. EventBridge rule is ENABLED: `aws events describe-rule --name gitlab-ec2-start-weekday`
2. Lambda target is configured: `aws events list-targets-by-rule --rule gitlab-ec2-start-weekday`
3. Lambda has EventBridge permission: Check function policy
4. CloudWatch logs for errors: `aws logs tail /aws/lambda/gitlab-ec2-start`

### Instance doesn't start/stop

**Check:**
1. Lambda CloudWatch logs for errors
2. EC2_INSTANCE_ID environment variable is correct
3. Lambda IAM role has EC2 permissions
4. Instance doesn't have override tag (`no-auto-start` / `no-auto-stop`)

### Graceful shutdown doesn't work

**Check:**
1. SSM agent is running on EC2 instance
2. Lambda IAM role has `ssm:SendCommand` permission
3. Shutdown script exists at `/opt/gitlab/scripts/graceful_shutdown.sh`
4. Instance has SSM permissions (instance profile)

### Dashboard shows "No Lambda ARN configured"

**Fix:**
1. Add Lambda ARNs to `backend/.env`
2. Restart backend
3. Call `/api/schedule/configure-targets` endpoint

## Benefits

✅ **Automated Scheduling**: EC2 starts/stops automatically on schedule
✅ **Cost Savings**: ~33% reduction in EC2 costs (112.5 hrs/week off)
✅ **Graceful Shutdown**: GitLab services shut down cleanly
✅ **Manual Override**: Tags prevent automated actions when needed
✅ **Audit Trail**: CloudWatch logs all executions
✅ **Idempotent**: Safe to run multiple times
✅ **Error Handling**: Continues even if graceful shutdown fails
✅ **Low Cost**: Lambda execution costs < $0.01/month

## Next Steps

1. Deploy Lambda functions using `./deploy_lambdas.sh`
2. Add Lambda ARNs to `backend/.env`
3. Restart backend
4. Test Lambda functions manually
5. Verify EventBridge targets are configured
6. Monitor CloudWatch logs for first scheduled execution
7. (Optional) Add manual override tags for testing

## Support

For issues or questions:
1. Check `infra/LAMBDA_DEPLOYMENT.md` for detailed troubleshooting
2. Review CloudWatch logs for Lambda execution errors
3. Verify IAM permissions match `infra/iam_policy.json`
4. Test Lambda functions manually before relying on schedule
