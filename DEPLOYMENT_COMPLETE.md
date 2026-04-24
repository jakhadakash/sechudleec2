# Deployment Complete - Next Steps

## ✅ What's Done

Your Lambda functions have been successfully deployed:

- ✅ Lambda function: `gitlab-ec2-start` created
- ✅ Lambda function: `gitlab-ec2-stop` created
- ✅ IAM role: `GitLabEC2SchedulerLambdaRole` created
- ✅ EventBridge permissions granted
- ✅ Lambda ARNs added to `backend/.env`

## 🚀 Next Steps

### Step 1: Create EventBridge Rules

The Lambda functions are deployed, but the EventBridge rules (schedules) don't exist yet. Create them:

```bash
cd ec2-dashboard/infra
./create_eventbridge_rules.sh
```

This will create:
- `gitlab-ec2-start-weekday` - Start Mon-Sat at 9:00am IST
- `gitlab-ec2-stop-weekday` - Stop Mon-Sat at 9:00pm IST

### Step 2: Restart Backend

Restart your backend to load the new Lambda ARNs:

```bash
cd ec2-dashboard

# If using systemd
sudo systemctl restart ec2-dashboard-backend

# Or if running manually
source backend/venv/bin/activate
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Test Lambda Functions

Test the Lambda functions manually before relying on scheduled execution:

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

Expected response:
```json
{
  "statusCode": 200,
  "body": "{\"message\": \"Instance start initiated\", \"instance_id\": \"i-0a317eb53175195bf\", \"previous_state\": \"stopped\"}"
}
```

### Step 4: Verify EventBridge Integration

After creating the rules, verify they're configured correctly:

```bash
# Check rules exist
aws events describe-rule --name gitlab-ec2-start-weekday --region ap-south-1
aws events describe-rule --name gitlab-ec2-stop-weekday --region ap-south-1

# Check Lambda targets are configured
aws events list-targets-by-rule --rule gitlab-ec2-start-weekday --region ap-south-1
aws events list-targets-by-rule --rule gitlab-ec2-stop-weekday --region ap-south-1
```

### Step 5: Test Dashboard API

Test the dashboard API endpoints:

```bash
# Get instance status
curl -H "X-API-Key: a3f8c2d1e4b7a9f0c3d2e1b4a7f8c9d0e3f2a1b4c7d8e9f0a3b2c1d4e5f6a7b8" \
  http://localhost:8000/api/status

# Get schedule
curl -H "X-API-Key: a3f8c2d1e4b7a9f0c3d2e1b4a7f8c9d0e3f2a1b4c7d8e9f0a3b2c1d4e5f6a7b8" \
  http://localhost:8000/api/schedule

# Configure Lambda targets via API
curl -X POST \
  -H "X-API-Key: a3f8c2d1e4b7a9f0c3d2e1b4a7f8c9d0e3f2a1b4c7d8e9f0a3b2c1d4e5f6a7b8" \
  http://localhost:8000/api/schedule/configure-targets
```

## 📊 Monitoring

### View Lambda Logs

Monitor Lambda execution in real-time:

```bash
# START Lambda logs
aws logs tail /aws/lambda/gitlab-ec2-start --follow --region ap-south-1

# STOP Lambda logs
aws logs tail /aws/lambda/gitlab-ec2-stop --follow --region ap-south-1
```

### Check CloudWatch Metrics

View Lambda metrics in AWS Console:
1. Go to CloudWatch → Metrics
2. Select Lambda
3. View: Invocations, Errors, Duration

## 🏷️ Manual Override

If you need to prevent automated actions (e.g., during maintenance):

```bash
# Prevent automated stop
aws ec2 create-tags \
  --resources i-0a317eb53175195bf \
  --tags Key=no-auto-stop,Value=true \
  --region ap-south-1

# Remove override
aws ec2 delete-tags \
  --resources i-0a317eb53175195bf \
  --tags Key=no-auto-stop \
  --region ap-south-1
```

## 🔧 Configuration

Your current configuration:

```
AWS Region: ap-south-1
AWS Account: 720712330515
EC2 Instance: i-0a317eb53175195bf
GitLab Host: mygitlab.idealittechno.in

Lambda Functions:
  START: arn:aws:lambda:ap-south-1:720712330515:function:gitlab-ec2-start
  STOP:  arn:aws:lambda:ap-south-1:720712330515:function:gitlab-ec2-stop

EventBridge Rules (to be created):
  gitlab-ec2-start-weekday: cron(30 3 ? * MON-SAT *)
  gitlab-ec2-stop-weekday: cron(30 15 ? * MON-SAT *)

Schedule:
  Start: Mon-Sat 9:00am IST (3:30 UTC)
  Stop: Mon-Sat 9:00pm IST (15:30 UTC)
  Sunday: Fully off
```

## 📅 Schedule Details

| Day | Start Time | Stop Time | Hours Off |
|-----|------------|-----------|-----------|
| Monday | 9:00am IST | 9:00pm IST | 12 hours |
| Tuesday | 9:00am IST | 9:00pm IST | 12 hours |
| Wednesday | 9:00am IST | 9:00pm IST | 12 hours |
| Thursday | 9:00am IST | 9:00pm IST | 12 hours |
| Friday | 9:00am IST | 9:00pm IST | 12 hours |
| Saturday | 9:00am IST | 9:00pm IST | 12 hours |
| Sunday | OFF | OFF | 24 hours |

**Total off per week:** ~96 hours (57% uptime)
**Expected cost reduction:** ~43%

## 🔄 Updating Instance ID Later

If you need to change the EC2 instance ID:

```bash
# 1. Edit backend/.env
EC2_INSTANCE_ID=i-NEW_INSTANCE_ID

# 2. Update Lambda functions
cd ec2-dashboard/infra
./update_lambda_instance.sh

# 3. Restart backend
```

## 🛠️ Troubleshooting

### Lambda doesn't execute on schedule

**Check:**
1. EventBridge rules exist: `aws events describe-rule --name gitlab-ec2-start-weekday`
2. Lambda targets configured: `aws events list-targets-by-rule --rule gitlab-ec2-start-weekday`
3. Lambda has EventBridge permission: `aws lambda get-policy --function-name gitlab-ec2-start`
4. CloudWatch logs for errors: `aws logs tail /aws/lambda/gitlab-ec2-start`

### Instance doesn't start/stop

**Check:**
1. Lambda CloudWatch logs for errors
2. EC2_INSTANCE_ID is correct in Lambda environment
3. Lambda IAM role has EC2 permissions
4. No override tags on instance

### Dashboard shows errors

**Check:**
1. Backend is running: `curl http://localhost:8000/health`
2. Lambda ARNs in .env are correct
3. Backend has been restarted after .env changes
4. API key is correct

## 📚 Documentation

- **Quick Start**: [QUICK_LAMBDA_SETUP.md](QUICK_LAMBDA_SETUP.md)
- **FAQ**: [LAMBDA_FAQ.md](LAMBDA_FAQ.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **IAM Permissions**: [IAM_PERMISSIONS_SUMMARY.md](IAM_PERMISSIONS_SUMMARY.md)
- **Detailed Guide**: [infra/LAMBDA_DEPLOYMENT.md](infra/LAMBDA_DEPLOYMENT.md)

## ✅ Checklist

- [x] Lambda functions deployed
- [x] IAM role created
- [x] Lambda ARNs added to .env
- [ ] EventBridge rules created (`./create_eventbridge_rules.sh`)
- [ ] Backend restarted
- [ ] Lambda functions tested manually
- [ ] EventBridge targets verified
- [ ] Dashboard API tested
- [ ] CloudWatch logs monitored

## 🎉 Success Criteria

Your setup is complete when:

1. ✅ Lambda functions invoke successfully
2. ✅ EventBridge rules exist and are ENABLED
3. ✅ Lambda targets are configured on rules
4. ✅ Dashboard shows current schedule
5. ✅ Manual start/stop works from dashboard
6. ✅ CloudWatch logs show successful executions

## 💰 Cost Estimate

With this setup:

- Lambda: < $0.01/month (within free tier)
- EventBridge: $0 (no charge)
- CloudWatch Logs: ~$0.50/month
- **Total: < $1/month**

EC2 cost savings: **~43% reduction** (96 hrs/week off)

## 🚨 Important Notes

1. **EventBridge rules must be created** - Run `./create_eventbridge_rules.sh`
2. **Backend must be restarted** - To load Lambda ARNs from .env
3. **Test before relying on schedule** - Invoke Lambda functions manually first
4. **Monitor CloudWatch logs** - Especially for first scheduled execution
5. **Override tags available** - Use `no-auto-stop` tag during maintenance

## 🆘 Need Help?

- Check [LAMBDA_FAQ.md](LAMBDA_FAQ.md) for common questions
- Review CloudWatch logs for error details
- Verify IAM permissions match [IAM_PERMISSIONS_SUMMARY.md](IAM_PERMISSIONS_SUMMARY.md)
- Test Lambda functions manually to isolate issues

---

**Next immediate action:** Run `./create_eventbridge_rules.sh` to complete the setup!
