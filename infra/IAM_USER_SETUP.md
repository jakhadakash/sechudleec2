# IAM User Setup Guide

This guide explains how to create an IAM user with the correct permissions for deploying Lambda functions and running the dashboard API.

## Overview

You need TWO separate IAM policies:

1. **Deployment Policy** - For initial Lambda deployment (one-time setup)
2. **Runtime Policy** - For dashboard API operations (ongoing use)

## Option 1: Single User with Both Policies (Recommended)

Create one IAM user with both policies attached. This user can deploy Lambda functions AND run the dashboard API.

### Step 1: Create IAM User

```bash
# Create the user
aws iam create-user --user-name ec2-dashboard-admin

# Create access keys
aws iam create-access-key --user-name ec2-dashboard-admin
```

Save the `AccessKeyId` and `SecretAccessKey` from the output.

### Step 2: Create and Attach Deployment Policy

```bash
# Create deployment policy
aws iam create-policy \
  --policy-name EC2DashboardDeploymentPolicy \
  --policy-document file://iam_deployment_policy.json

# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Attach deployment policy
aws iam attach-user-policy \
  --user-name ec2-dashboard-admin \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy
```

### Step 3: Create and Attach Runtime Policy

```bash
# Create runtime policy
aws iam create-policy \
  --policy-name EC2DashboardRuntimePolicy \
  --policy-document file://iam_runtime_policy.json

# Attach runtime policy
aws iam attach-user-policy \
  --user-name ec2-dashboard-admin \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy
```

### Step 4: Configure Backend

Add the access keys to `backend/.env`:

```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-south-1
```

### Step 5: Deploy Lambda Functions

```bash
cd ec2-dashboard/infra
./deploy_lambdas.sh
```

## Option 2: Separate Users (More Secure)

Create two separate IAM users:
- **Deployment User** - Only for Lambda deployment (use once, then disable)
- **Runtime User** - For dashboard API (ongoing use)

### Deployment User

```bash
# Create deployment user
aws iam create-user --user-name ec2-dashboard-deployer

# Create access keys
aws iam create-access-key --user-name ec2-dashboard-deployer

# Attach deployment policy
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam attach-user-policy \
  --user-name ec2-dashboard-deployer \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy
```

Use this user's credentials to run `deploy_lambdas.sh`, then:

```bash
# Disable access keys after deployment
aws iam update-access-key \
  --user-name ec2-dashboard-deployer \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --status Inactive
```

### Runtime User

```bash
# Create runtime user
aws iam create-user --user-name ec2-dashboard-runtime

# Create access keys
aws iam create-access-key --user-name ec2-dashboard-runtime

# Attach runtime policy
aws iam attach-user-policy \
  --user-name ec2-dashboard-runtime \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy
```

Use this user's credentials in `backend/.env` for ongoing operations.

## Option 3: Instance Profile (Production - Most Secure)

If your backend runs on EC2, use an instance profile instead of access keys.

### Step 1: Create IAM Role

```bash
# Create trust policy
cat > /tmp/ec2-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name EC2DashboardBackendRole \
  --assume-role-policy-document file:///tmp/ec2-trust-policy.json
```

### Step 2: Attach Runtime Policy

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws iam attach-role-policy \
  --role-name EC2DashboardBackendRole \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy
```

### Step 3: Create Instance Profile

```bash
# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name EC2DashboardBackendProfile

# Add role to instance profile
aws iam add-role-to-instance-profile \
  --instance-profile-name EC2DashboardBackendProfile \
  --role-name EC2DashboardBackendRole
```

### Step 4: Attach to EC2 Instance

```bash
# Attach instance profile
aws ec2 associate-iam-instance-profile \
  --instance-id i-YOUR_INSTANCE_ID \
  --iam-instance-profile Name=EC2DashboardBackendProfile
```

### Step 5: Configure Backend

Leave credentials empty in `backend/.env`:

```bash
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
```

The backend will automatically use the instance profile credentials.

## Policy Details

### Deployment Policy Permissions

**What it allows:**
- Create and update Lambda functions
- Create IAM roles and policies for Lambda
- Configure EventBridge rules and targets
- Create CloudWatch log groups
- Get AWS account information

**When to use:**
- Running `deploy_lambdas.sh`
- Updating Lambda function code
- Initial infrastructure setup

**Security note:** This policy has elevated permissions. Disable or delete after deployment.

### Runtime Policy Permissions

**What it allows:**
- Start/stop EC2 instances
- Describe EC2 instances and tags
- Manage EventBridge schedules
- Query Cost Explorer
- Send SNS alerts
- Execute SSM commands
- Get CloudWatch metrics
- Update Lambda environment variables (for instance ID changes)

**When to use:**
- Dashboard API operations
- Manual start/stop
- Schedule management
- Monitoring and alerts
- Running `update_lambda_instance.sh`

**Security note:** This policy follows least-privilege principle for ongoing operations.

## Permission Breakdown

### Deployment Policy Actions

```
Lambda:
  - CreateFunction          # Deploy new Lambda functions
  - UpdateFunctionCode      # Update Lambda code
  - UpdateFunctionConfiguration  # Update Lambda settings
  - GetFunction             # Read Lambda details
  - AddPermission           # Grant EventBridge invoke permission
  - GetPolicy               # Read Lambda resource policy

IAM:
  - CreateRole              # Create Lambda execution role
  - CreatePolicy            # Create custom policies
  - AttachRolePolicy        # Attach policies to role
  - PassRole                # Allow Lambda to assume role

EventBridge:
  - PutRule                 # Create/update rules
  - PutTargets              # Configure Lambda targets

CloudWatch Logs:
  - CreateLogGroup          # Create log groups for Lambda

STS:
  - GetCallerIdentity       # Get AWS account ID
```

### Runtime Policy Actions

```
EC2:
  - StartInstances          # Manual start
  - StopInstances           # Manual stop
  - DescribeInstances       # Get instance status
  - DescribeTags            # Check override tags

EventBridge:
  - DescribeRule            # Get schedule details
  - PutRule                 # Update schedules
  - PutTargets              # Configure targets
  - EnableRule/DisableRule  # Toggle schedules

Cost Explorer:
  - GetCostAndUsage         # Query costs

CloudWatch:
  - GetMetricStatistics     # Get CPU credits

SNS:
  - Publish                 # Send alerts

SSM:
  - SendCommand             # Graceful shutdown

Lambda:
  - GetFunction             # Read Lambda details
  - UpdateFunctionConfiguration  # Update instance ID
```

## Security Best Practices

### 1. Use Least Privilege

✅ **Do:**
- Use separate deployment and runtime policies
- Disable deployment user after setup
- Use instance profiles for EC2-hosted backends

❌ **Don't:**
- Give `AdministratorAccess` policy
- Use root account credentials
- Share access keys

### 2. Rotate Access Keys

```bash
# Create new access key
aws iam create-access-key --user-name ec2-dashboard-runtime

# Update backend/.env with new keys

# Restart backend to load new keys

# Delete old access key
aws iam delete-access-key \
  --user-name ec2-dashboard-runtime \
  --access-key-id OLD_ACCESS_KEY_ID
```

Rotate every 90 days.

### 3. Enable MFA for Deployment User

```bash
# Enable MFA for deployment operations
aws iam enable-mfa-device \
  --user-name ec2-dashboard-deployer \
  --serial-number arn:aws:iam::ACCOUNT_ID:mfa/ec2-dashboard-deployer \
  --authentication-code-1 123456 \
  --authentication-code-2 789012
```

### 4. Use CloudTrail

Enable CloudTrail to audit all API calls:

```bash
aws cloudtrail create-trail \
  --name ec2-dashboard-audit \
  --s3-bucket-name your-cloudtrail-bucket

aws cloudtrail start-logging \
  --name ec2-dashboard-audit
```

### 5. Restrict by IP (Optional)

Add IP restriction to runtime policy:

```json
{
  "Condition": {
    "IpAddress": {
      "aws:SourceIp": [
        "203.0.113.0/24"
      ]
    }
  }
}
```

### 6. Use AWS Secrets Manager (Advanced)

Store credentials in Secrets Manager instead of .env:

```bash
# Store credentials
aws secretsmanager create-secret \
  --name ec2-dashboard/credentials \
  --secret-string '{"AWS_ACCESS_KEY_ID":"AKIA...","AWS_SECRET_ACCESS_KEY":"..."}'

# Update backend to read from Secrets Manager
```

## Testing Permissions

### Test Deployment Permissions

```bash
# Set deployment user credentials
export AWS_ACCESS_KEY_ID=AKIA_DEPLOYMENT_KEY
export AWS_SECRET_ACCESS_KEY=SECRET_DEPLOYMENT_KEY

# Test Lambda creation
aws lambda get-function --function-name gitlab-ec2-start 2>&1 | grep -q "ResourceNotFoundException" && echo "✓ Can query Lambda" || echo "✗ Cannot query Lambda"

# Test IAM role creation
aws iam get-role --role-name GitLabEC2SchedulerLambdaRole 2>&1 | grep -q "NoSuchEntity" && echo "✓ Can query IAM" || echo "✗ Cannot query IAM"
```

### Test Runtime Permissions

```bash
# Set runtime user credentials
export AWS_ACCESS_KEY_ID=AKIA_RUNTIME_KEY
export AWS_SECRET_ACCESS_KEY=SECRET_RUNTIME_KEY

# Test EC2 describe
aws ec2 describe-instances --instance-ids i-YOUR_INSTANCE_ID && echo "✓ Can describe EC2" || echo "✗ Cannot describe EC2"

# Test EventBridge
aws events describe-rule --name gitlab-ec2-start-weekday && echo "✓ Can query EventBridge" || echo "✗ Cannot query EventBridge"

# Test Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-02 \
  --granularity DAILY \
  --metrics UnblendedCost && echo "✓ Can query Cost Explorer" || echo "✗ Cannot query Cost Explorer"
```

## Troubleshooting

### "Access Denied" during deployment

**Cause:** Deployment policy not attached or insufficient permissions

**Fix:**
```bash
# Verify policy is attached
aws iam list-attached-user-policies --user-name ec2-dashboard-admin

# Attach deployment policy
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam attach-user-policy \
  --user-name ec2-dashboard-admin \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy
```

### "Access Denied" during API operations

**Cause:** Runtime policy not attached or insufficient permissions

**Fix:**
```bash
# Verify policy is attached
aws iam list-attached-user-policies --user-name ec2-dashboard-admin

# Attach runtime policy
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam attach-user-policy \
  --user-name ec2-dashboard-admin \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy
```

### "Invalid credentials" error

**Cause:** Access keys not configured correctly

**Fix:**
```bash
# Verify credentials in .env
cat backend/.env | grep AWS_ACCESS_KEY_ID

# Test credentials
aws sts get-caller-identity
```

### Cost Explorer access denied

**Cause:** Cost Explorer not enabled or IAM user lacks permissions

**Fix:**
1. Enable Cost Explorer in AWS Console (Billing → Cost Explorer)
2. Wait 24 hours for data to populate
3. Verify IAM policy includes `ce:GetCostAndUsage`

## Quick Reference

### Deployment User Permissions
- Lambda: Create, update, configure
- IAM: Create roles and policies
- EventBridge: Create rules and targets
- CloudWatch Logs: Create log groups

### Runtime User Permissions
- EC2: Start, stop, describe
- EventBridge: Manage schedules
- Cost Explorer: Query costs
- CloudWatch: Get metrics
- SNS: Send alerts
- SSM: Execute commands
- Lambda: Update configuration

### Recommended Setup
1. **Development**: Single user with both policies
2. **Production**: Instance profile (no access keys)
3. **Deployment**: Separate user, disabled after setup

### Policy Files
- `iam_deployment_policy.json` - For Lambda deployment
- `iam_runtime_policy.json` - For dashboard API
- `iam_policy.json` - Combined (legacy, use separate policies instead)
