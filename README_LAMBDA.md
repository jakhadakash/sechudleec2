# Lambda Integration for EC2 Scheduler

## Quick Answer to Your Question

**Q: Can I update EC2 instance ID later through .env for start/stop?**

**A: Yes, but you need to update it in TWO places:**

```bash
# 1. Update backend/.env
EC2_INSTANCE_ID=i-NEW_INSTANCE_ID

# 2. Update Lambda functions (automated script)
cd ec2-dashboard/infra
./update_lambda_instance.sh

# 3. Restart backend
cd ec2-dashboard
uvicorn backend.main:app --reload
```

### Why Two Places?

- **Backend .env**: Used by dashboard API for manual start/stop buttons
- **Lambda environment**: Used by EventBridge for scheduled automation

They're separate services, so each needs its own configuration. The `update_lambda_instance.sh` script keeps them in sync automatically.

## Documentation Index

Choose the guide that fits your needs:

### 🚀 Quick Start
- **[QUICK_LAMBDA_SETUP.md](QUICK_LAMBDA_SETUP.md)** - 5-minute setup guide

### 📚 Detailed Guides
- **[LAMBDA_DEPLOYMENT.md](infra/LAMBDA_DEPLOYMENT.md)** - Complete deployment instructions
- **[LAMBDA_INTEGRATION_SUMMARY.md](LAMBDA_INTEGRATION_SUMMARY.md)** - Architecture and implementation details
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Visual diagrams and data flows

### ❓ Help & Troubleshooting
- **[LAMBDA_FAQ.md](LAMBDA_FAQ.md)** - Frequently asked questions
- **[AWS_SETUP_GUIDE.md](AWS_SETUP_GUIDE.md)** - AWS configuration and troubleshooting

## What Lambda Functions Do

Lambda functions enable **automated** EC2 start/stop on schedule:

```
Without Lambda:
- Manual start/stop only (dashboard buttons)
- No cost savings unless you remember to stop instance

With Lambda:
- Automated start/stop on schedule
- ~33% cost reduction (112.5 hrs/week off)
- Manual override capability via tags
- Graceful GitLab shutdown before stop
```

## Files Added

```
ec2-dashboard/
├── infra/
│   ├── lambda_ec2_start.py          # Lambda function to start EC2
│   ├── lambda_ec2_stop.py           # Lambda function to stop EC2
│   ├── deploy_lambdas.sh            # Automated deployment script
│   ├── update_lambda_instance.sh    # Update instance ID script
│   ├── LAMBDA_DEPLOYMENT.md         # Detailed deployment guide
│   └── iam_policy.json              # Updated with Lambda permissions
├── LAMBDA_INTEGRATION_SUMMARY.md    # Architecture overview
├── LAMBDA_FAQ.md                    # Frequently asked questions
├── ARCHITECTURE.md                  # Visual diagrams
├── QUICK_LAMBDA_SETUP.md            # Quick start guide
└── README_LAMBDA.md                 # This file
```

## Common Tasks

### Initial Setup

```bash
cd ec2-dashboard/infra
./deploy_lambdas.sh
# Follow prompts, then add Lambda ARNs to backend/.env
```

### Change EC2 Instance ID

```bash
# Edit backend/.env
EC2_INSTANCE_ID=i-NEW_INSTANCE_ID

# Sync to Lambda
cd ec2-dashboard/infra
./update_lambda_instance.sh

# Restart backend
```

### Prevent Automated Stop (Maintenance)

```bash
aws ec2 create-tags \
  --resources i-YOUR_INSTANCE_ID \
  --tags Key=no-auto-stop,Value=true
```

### View Lambda Logs

```bash
aws logs tail /aws/lambda/gitlab-ec2-start --follow
aws logs tail /aws/lambda/gitlab-ec2-stop --follow
```

### Test Lambda Functions

```bash
aws lambda invoke \
  --function-name gitlab-ec2-start \
  /tmp/start.json

cat /tmp/start.json
```

## Key Concepts

### Two Configuration Locations

| Location | Used By | Updated By |
|----------|---------|------------|
| `backend/.env` | Dashboard API (manual control) | Edit file + restart backend |
| Lambda environment | EventBridge (scheduled control) | `update_lambda_instance.sh` |

### Manual Override Tags

| Tag | Effect |
|-----|--------|
| `no-auto-stop=true` | Skip automated stop |
| `no-auto-start=true` | Skip automated start |

### Lambda Functions

| Function | Triggered By | Schedule | Action |
|----------|--------------|----------|--------|
| `gitlab-ec2-start` | EventBridge rule | Mon-Sat 9:00am IST | Start instance |
| `gitlab-ec2-stop` | EventBridge rule | Mon-Sat 9:00pm IST | Graceful stop |

## Architecture Summary

```
Dashboard (Manual)          EventBridge (Automated)
     │                             │
     │ reads .env                  │ triggers on schedule
     ▼                             ▼
Backend API                   Lambda Functions
     │                             │
     │ reads EC2_INSTANCE_ID       │ reads EC2_INSTANCE_ID
     │ from .env                   │ from Lambda env
     ▼                             ▼
        AWS EC2 API (start/stop)
                 │
                 ▼
           EC2 Instance
```

## Cost

- Lambda: < $0.01/month (within free tier)
- EventBridge: $0 (no charge)
- CloudWatch Logs: ~$0.50/month
- **Total: < $1/month**

## Benefits

✅ Automated scheduling (no manual intervention)
✅ ~33% cost reduction (112.5 hrs/week off)
✅ Graceful GitLab shutdown (no data loss)
✅ Manual override capability (maintenance mode)
✅ CloudWatch logging (audit trail)
✅ Idempotent (safe to run multiple times)
✅ Low cost (< $1/month)

## Next Steps

1. **Deploy Lambda functions**: `cd infra && ./deploy_lambdas.sh`
2. **Update .env**: Add Lambda ARNs from deployment output
3. **Restart backend**: Load new configuration
4. **Test**: Invoke Lambda functions manually
5. **Monitor**: Check CloudWatch logs for first scheduled execution

## Getting Help

- **Quick questions**: See [LAMBDA_FAQ.md](LAMBDA_FAQ.md)
- **Deployment issues**: See [LAMBDA_DEPLOYMENT.md](infra/LAMBDA_DEPLOYMENT.md)
- **Architecture questions**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **AWS setup**: See [AWS_SETUP_GUIDE.md](AWS_SETUP_GUIDE.md)

## Important Notes

⚠️ **Remember**: Changing EC2_INSTANCE_ID requires updating BOTH:
1. `backend/.env` (for manual control)
2. Lambda environment (for automated control)

Use `./update_lambda_instance.sh` to keep them in sync!

✅ **Good news**: The update script reads from your .env file automatically, so you only need to edit one file and run the script.
