# AWS Setup Guide for EC2 Scheduler Dashboard

This guide will help you fix AWS connectivity issues and properly configure the dashboard.

## Quick Diagnosis

Run the diagnostic script to identify issues:

```bash
cd ec2-dashboard
python backend/test_aws_connection.py
```

This will test:
- ✓ AWS credentials
- ✓ EC2 access
- ✓ EventBridge access
- ✓ CloudWatch access
- ✓ Cost Explorer access
- ✓ SNS access

## Common Issues and Fixes

### Issue 1: No AWS Credentials

**Error:** `No credentials found!`

**Fix Option A - Use IAM User Access Keys (Development):**

1. Create an IAM user in AWS Console
2. Attach the policy from `infra/iam_policy.json`
3. Create access keys for the user
4. Update `.env`:
   ```bash
   AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
   AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

**Fix Option B - Use IAM Instance Profile (Production):**

1. Create an IAM role with the policy from `infra/iam_policy.json`
2. Attach the role to your EC2 instance
3. Leave credentials empty in `.env`:
   ```bash
   AWS_ACCESS_KEY_ID=
   AWS_SECRET_ACCESS_KEY=
   ```

### Issue 2: Invalid EC2 Instance ID

**Error:** `Instance i-0xxxxxxxxxxxxxxx not found!`

**Fix:**

1. Find your instance ID:
   ```bash
   aws ec2 describe-instances --region ap-south-1 \
     --query 'Reservations[*].Instances[*].[InstanceId,Tags[?Key==`Name`].Value|[0],State.Name]' \
     --output table
   ```

2. Update `.env`:
   ```bash
   EC2_INSTANCE_ID=i-0123456789abcdef0
   ```

### Issue 3: EventBridge Rules Not Found

**Error:** `EventBridge rule 'gitlab-ec2-start-weekday' not found`

**Fix:**

1. Create EventBridge rules using AWS CLI:

   ```bash
   # Create start rule
   aws events put-rule \
     --name gitlab-ec2-start-weekday \
     --schedule-expression "cron(30 3 ? * MON-SAT *)" \
     --description "Start GitLab EC2 at 9:00am IST (03:30 UTC) Mon-Sat" \
     --state ENABLED \
     --region ap-south-1

   # Create stop rule
   aws events put-rule \
     --name gitlab-ec2-stop-weekday \
     --schedule-expression "cron(30 15 ? * MON-SAT *)" \
     --description "Stop GitLab EC2 at 9:00pm IST (15:30 UTC) Mon-Sat" \
     --state ENABLED \
     --region ap-south-1
   ```

2. Add targets (Lambda function or direct EC2 API call)

   See `infra/eventbridge_rules.json` for complete configuration.

### Issue 4: Permission Denied Errors

**Error:** `Not authorized to describe EC2 instances!`

**Fix:**

1. Ensure your IAM user/role has the required permissions
2. Apply the policy from `infra/iam_policy.json`:

   ```bash
   # Create policy
   aws iam create-policy \
     --policy-name EC2DashboardPolicy \
     --policy-document file://infra/iam_policy.json

   # Attach to user
   aws iam attach-user-policy \
     --user-name your-username \
     --policy-arn arn:aws:iam::ACCOUNT_ID:policy/EC2DashboardPolicy

   # OR attach to role (for instance profile)
   aws iam attach-role-policy \
     --role-name your-role-name \
     --policy-arn arn:aws:iam::ACCOUNT_ID:policy/EC2DashboardPolicy
   ```

### Issue 5: Cost Explorer Access Denied

**Error:** `Not authorized to access Cost Explorer!`

**Fix:**

1. Enable Cost Explorer in AWS Console:
   - Go to AWS Billing Console
   - Click "Cost Explorer"
   - Click "Enable Cost Explorer"

2. Ensure IAM policy includes:
   ```json
   {
     "Effect": "Allow",
     "Action": ["ce:GetCostAndUsage"],
     "Resource": "*"
   }
   ```

### Issue 6: SNS Topic Not Found

**Error:** `SNS topic not found!`

**Fix Option A - Create SNS Topic:**

```bash
# Create topic
aws sns create-topic --name gitlab-alerts --region ap-south-1

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:ACCOUNT_ID:gitlab-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

**Fix Option B - Disable Alerts:**

Leave SNS_TOPIC_ARN empty in `.env`:
```bash
SNS_TOPIC_ARN=
```

## Step-by-Step Setup

### 1. Configure AWS Credentials

**Option A: Interactive Setup**
```bash
./setup_aws_config.sh
```

**Option B: Manual Setup**

Edit `backend/.env`:
```bash
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
EC2_INSTANCE_ID=i-0123456789abcdef0
GITLAB_HOST=gitlab.example.com
SSH_KEY_PATH=/home/ubuntu/.ssh/id_rsa
DASHBOARD_API_KEY=your-random-api-key
SNS_TOPIC_ARN=arn:aws:sns:ap-south-1:ACCOUNT:gitlab-alerts
EVENTBRIDGE_RULE_STOP=gitlab-ec2-stop-weekday
EVENTBRIDGE_RULE_START=gitlab-ec2-start-weekday
SSL_DOMAINS=gitlab.example.com
```

### 2. Test AWS Connectivity

```bash
python backend/test_aws_connection.py
```

Fix any errors reported by the diagnostic tool.

### 3. Create IAM Policy

```bash
aws iam create-policy \
  --policy-name EC2DashboardPolicy \
  --policy-document file://infra/iam_policy.json
```

### 4. Create EventBridge Rules

See `infra/eventbridge_rules.json` for rule definitions.

You'll need to:
1. Create the rules
2. Add targets (Lambda or direct EC2 API)
3. Configure IAM permissions for targets

### 5. Create SNS Topic (Optional)

```bash
# Create topic
aws sns create-topic --name gitlab-alerts --region ap-south-1

# Subscribe email
aws sns subscribe \
  --topic-arn arn:aws:sns:ap-south-1:ACCOUNT_ID:gitlab-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com

# Update .env with topic ARN
```

### 6. Start the Backend

```bash
cd ec2-dashboard
source backend/venv/bin/activate  # if using virtualenv
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 7. Test the API

```bash
# Health check (no auth required)
curl http://localhost:8000/health

# EC2 status (requires API key)
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/status
```

## Troubleshooting

### Backend won't start

**Check Python dependencies:**
```bash
pip install -r backend/requirements.txt
```

**Check .env file exists:**
```bash
ls -la backend/.env
```

### API returns 401 Unauthorized

**Check API key:**
- Ensure `DASHBOARD_API_KEY` is set in `.env`
- Use the same key in `X-API-Key` header

### API returns 500 Internal Server Error

**Check backend logs:**
```bash
# Run with verbose logging
uvicorn backend.main:app --reload --log-level debug
```

**Common causes:**
- Invalid AWS credentials
- Missing EC2 instance ID
- Network connectivity issues
- IAM permission issues

### Dashboard shows "N/A" or "—" for all data

**Check:**
1. Backend is running: `curl http://localhost:8000/health`
2. API key is correct in browser localStorage
3. CORS is configured correctly
4. Browser console for errors (F12)

## Security Best Practices

### For Development

- Use IAM user with access keys
- Restrict IAM policy to minimum required permissions
- Rotate access keys regularly
- Never commit `.env` to version control

### For Production

- Use IAM instance profile (no access keys)
- Enable CloudTrail logging
- Use AWS Secrets Manager for API key
- Configure CORS to restrict origins
- Enable nginx rate limiting
- Use HTTPS only
- Restrict dashboard access by IP (optional)

## Getting Help

If you're still having issues:

1. Run the diagnostic: `python backend/test_aws_connection.py`
2. Check backend logs: `uvicorn backend.main:app --log-level debug`
3. Check browser console (F12) for frontend errors
4. Verify IAM permissions match `infra/iam_policy.json`
5. Ensure all required AWS services are available in your region

## Quick Reference

### Required AWS Services
- EC2 (Elastic Compute Cloud)
- EventBridge (CloudWatch Events)
- CloudWatch (Metrics)
- Cost Explorer (Billing)
- SNS (Simple Notification Service) - Optional
- SSM (Systems Manager) - For graceful shutdown

### Required IAM Permissions
See `infra/iam_policy.json` for complete list:
- `ec2:DescribeInstances`
- `ec2:StartInstances`
- `ec2:StopInstances`
- `events:DescribeRule`
- `events:PutRule`
- `cloudwatch:GetMetricStatistics`
- `ce:GetCostAndUsage`
- `sns:Publish`
- `ssm:SendCommand`

### Environment Variables
- `AWS_REGION` - AWS region (e.g., ap-south-1)
- `AWS_ACCESS_KEY_ID` - IAM user access key (optional)
- `AWS_SECRET_ACCESS_KEY` - IAM user secret key (optional)
- `EC2_INSTANCE_ID` - Target EC2 instance ID
- `GITLAB_HOST` - GitLab hostname for SSH
- `SSH_KEY_PATH` - Path to SSH private key
- `DASHBOARD_API_KEY` - API authentication key
- `SNS_TOPIC_ARN` - SNS topic for alerts (optional)
- `EVENTBRIDGE_RULE_START` - Start schedule rule name
- `EVENTBRIDGE_RULE_STOP` - Stop schedule rule name
- `SSL_DOMAINS` - Comma-separated domains to monitor
