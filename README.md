# EC2 Scheduler Dashboard

A lightweight web application for managing AWS EC2 instance lifecycle operations with automated scheduling, health monitoring, and cost tracking.

## Features

- 🚀 Manual EC2 start/stop controls
- ⏰ Automated scheduling with EventBridge + Lambda
- 📊 Real-time instance status monitoring
- 💰 Cost tracking and projections
- 🔒 SSL certificate expiry monitoring
- 💾 Disk usage monitoring
- 🔔 SNS alert notifications
- 🎨 Modern React UI with Tailwind CSS

## Quick Start

See [QUICK_START.md](QUICK_START.md) for basic setup.

## Lambda Integration (Automated Scheduling)

### Prerequisites

Create an IAM user with appropriate permissions:

```bash
cd infra
./create_iam_user.sh
```

See [infra/IAM_USER_SETUP.md](infra/IAM_USER_SETUP.md) for detailed permission requirements.

### Quick Setup

```bash
# 1. Deploy Lambda functions
cd infra
./deploy_lambdas.sh

# 2. Add Lambda ARNs to backend/.env
LAMBDA_START_ARN=arn:aws:lambda:region:account:function:gitlab-ec2-start
LAMBDA_STOP_ARN=arn:aws:lambda:region:account:function:gitlab-ec2-stop

# 3. Restart backend
```

### Updating EC2 Instance ID

**Important**: The EC2 instance ID is stored in TWO places:

```bash
# 1. Update backend/.env
EC2_INSTANCE_ID=i-NEW_INSTANCE_ID

# 2. Sync to Lambda functions
cd infra
./update_lambda_instance.sh

# 3. Restart backend
```

### Documentation

- **[README_LAMBDA.md](README_LAMBDA.md)** - Lambda integration overview
- **[QUICK_LAMBDA_SETUP.md](QUICK_LAMBDA_SETUP.md)** - 5-minute setup
- **[LAMBDA_FAQ.md](LAMBDA_FAQ.md)** - Common questions
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture
- **[infra/LAMBDA_DEPLOYMENT.md](infra/LAMBDA_DEPLOYMENT.md)** - Detailed guide

## Project Structure

```
ec2-dashboard/
├── backend/              # FastAPI backend
│   ├── routers/         # API endpoints
│   ├── services/        # AWS service integrations
│   └── main.py          # Application entry point
├── frontend-react/      # React dashboard
│   └── src/
│       ├── components/  # UI components
│       └── api/         # API client
├── infra/               # Infrastructure code
│   ├── lambda_ec2_start.py      # Start Lambda function
│   ├── lambda_ec2_stop.py       # Stop Lambda function
│   ├── deploy_lambdas.sh        # Deployment script
│   └── update_lambda_instance.sh # Update instance ID
└── docs/                # Documentation
```

## Configuration

### Backend (.env)

```bash
AWS_REGION=ap-south-1
EC2_INSTANCE_ID=i-0123456789abcdef0
LAMBDA_START_ARN=arn:aws:lambda:region:account:function:gitlab-ec2-start
LAMBDA_STOP_ARN=arn:aws:lambda:region:account:function:gitlab-ec2-stop
DASHBOARD_API_KEY=your-secret-key
```

### Lambda Environment Variables

Automatically configured by `deploy_lambdas.sh` or `update_lambda_instance.sh`:
- `EC2_INSTANCE_ID` - Target instance
- `GRACEFUL_SHUTDOWN_SCRIPT` - Shutdown script path (stop function only)

## Architecture

```
Dashboard → Backend API → AWS Services
                ↓
          Manual Control

EventBridge → Lambda → AWS EC2
                ↓
        Automated Scheduling
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed diagrams.

## Cost

- Lambda: < $0.01/month (within free tier)
- EventBridge: $0 (no charge)
- CloudWatch Logs: ~$0.50/month
- **Total: < $1/month**

With automated scheduling: **~33% EC2 cost reduction** (112.5 hrs/week off)

## Manual Override

Prevent automated actions during maintenance:

```bash
# Skip automated stop
aws ec2 create-tags \
  --resources i-YOUR_INSTANCE_ID \
  --tags Key=no-auto-stop,Value=true

# Remove override
aws ec2 delete-tags \
  --resources i-YOUR_INSTANCE_ID \
  --tags Key=no-auto-stop
```

## Monitoring

```bash
# View Lambda logs
aws logs tail /aws/lambda/gitlab-ec2-start --follow
aws logs tail /aws/lambda/gitlab-ec2-stop --follow

# Test Lambda functions
aws lambda invoke --function-name gitlab-ec2-start /tmp/start.json
```

## Support

- **Setup issues**: [AWS_SETUP_GUIDE.md](AWS_SETUP_GUIDE.md)
- **Lambda questions**: [LAMBDA_FAQ.md](LAMBDA_FAQ.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)

## License

MIT
