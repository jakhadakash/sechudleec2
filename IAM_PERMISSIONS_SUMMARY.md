# IAM Permissions Summary

## Quick Answer

**Q: What permissions do I need for deployment and API execution?**

**A: You need TWO separate sets of permissions:**

### 1. Deployment Permissions (One-time setup)

Used for running `deploy_lambdas.sh`:

```bash
# Quick setup
cd ec2-dashboard/infra
./create_iam_user.sh
# Choose option 1 (single user) or 2 (separate users)
```

**Permissions needed:**
- Lambda: Create/update functions
- IAM: Create roles and policies
- EventBridge: Create rules and targets
- CloudWatch Logs: Create log groups

### 2. Runtime Permissions (Ongoing use)

Used by the dashboard API for daily operations:

**Permissions needed:**
- EC2: Start/stop instances, describe status
- EventBridge: Manage schedules
- Cost Explorer: Query costs
- CloudWatch: Get metrics
- SNS: Send alerts
- SSM: Execute commands
- Lambda: Update configuration (for instance ID changes)

## Three Setup Options

### Option 1: Single User (Recommended for Development)

One IAM user with both deployment and runtime permissions.

**Pros:**
- ✅ Simple setup
- ✅ One set of credentials
- ✅ Can deploy and run API

**Cons:**
- ❌ More permissions than needed for daily use
- ❌ Less secure

**Setup:**
```bash
cd ec2-dashboard/infra
./create_iam_user.sh
# Choose option 1
```

### Option 2: Separate Users (More Secure)

Two IAM users:
- Deployment user (disable after setup)
- Runtime user (for daily operations)

**Pros:**
- ✅ Least privilege for runtime
- ✅ Can disable deployment user after setup
- ✅ Better security

**Cons:**
- ❌ Two sets of credentials to manage
- ❌ Slightly more complex

**Setup:**
```bash
cd ec2-dashboard/infra
./create_iam_user.sh
# Choose option 2
```

### Option 3: Instance Profile (Recommended for Production)

No IAM user credentials needed. Backend uses EC2 instance profile.

**Pros:**
- ✅ No access keys to manage
- ✅ Most secure
- ✅ Automatic credential rotation
- ✅ Best practice for production

**Cons:**
- ❌ Only works if backend runs on EC2
- ❌ Still need deployment user for Lambda setup

**Setup:**
```bash
cd ec2-dashboard/infra
./create_iam_user.sh
# Choose option 3
```

## Permission Breakdown

### Deployment Policy

**File:** `infra/iam_deployment_policy.json`

**What it allows:**

| Service | Actions | Purpose |
|---------|---------|---------|
| Lambda | CreateFunction, UpdateFunctionCode, AddPermission | Deploy Lambda functions |
| IAM | CreateRole, CreatePolicy, AttachRolePolicy | Create Lambda execution role |
| EventBridge | PutRule, PutTargets | Configure scheduled triggers |
| CloudWatch Logs | CreateLogGroup | Set up Lambda logging |
| STS | GetCallerIdentity | Get AWS account ID |

**When to use:**
- Running `deploy_lambdas.sh`
- Updating Lambda function code
- Initial infrastructure setup

**Security note:** Disable or delete after deployment.

### Runtime Policy

**File:** `infra/iam_runtime_policy.json`

**What it allows:**

| Service | Actions | Purpose |
|---------|---------|---------|
| EC2 | StartInstances, StopInstances, DescribeInstances | Manual start/stop, status monitoring |
| EventBridge | DescribeRule, PutRule, PutTargets | Schedule management |
| Cost Explorer | GetCostAndUsage | Cost tracking |
| CloudWatch | GetMetricStatistics | CPU credit monitoring |
| SNS | Publish | Alert notifications |
| SSM | SendCommand | Graceful shutdown |
| Lambda | GetFunction, UpdateFunctionConfiguration | Update instance ID |

**When to use:**
- Dashboard API operations
- Manual start/stop
- Schedule management
- Monitoring and alerts
- Running `update_lambda_instance.sh`

**Security note:** Follows least-privilege principle.

## Quick Setup Commands

### Create Single User (Development)

```bash
cd ec2-dashboard/infra

# Create IAM user with both policies
./create_iam_user.sh
# Choose option 1, enter username

# Add credentials to backend/.env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Deploy Lambda functions
./deploy_lambdas.sh

# Done!
```

### Create Separate Users (More Secure)

```bash
cd ec2-dashboard/infra

# Create deployment and runtime users
./create_iam_user.sh
# Choose option 2

# Use deployment user to deploy Lambda
export AWS_ACCESS_KEY_ID=AKIA_DEPLOYMENT...
export AWS_SECRET_ACCESS_KEY=...
./deploy_lambdas.sh

# Add runtime user to backend/.env
AWS_ACCESS_KEY_ID=AKIA_RUNTIME...
AWS_SECRET_ACCESS_KEY=...

# Disable deployment user
aws iam update-access-key \
  --user-name ec2-dashboard-deployer \
  --access-key-id AKIA_DEPLOYMENT... \
  --status Inactive
```

### Create Instance Profile (Production)

```bash
cd ec2-dashboard/infra

# Create instance profile
./create_iam_user.sh
# Choose option 3

# Attach to EC2 instance
aws ec2 associate-iam-instance-profile \
  --instance-id i-YOUR_INSTANCE_ID \
  --iam-instance-profile Name=EC2DashboardBackendProfile

# Leave credentials empty in backend/.env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Backend will use instance profile automatically
```

## Manual Setup (Without Script)

If you prefer manual setup, see [infra/IAM_USER_SETUP.md](infra/IAM_USER_SETUP.md) for detailed step-by-step instructions.

## Testing Permissions

### Test Deployment Permissions

```bash
# Set deployment credentials
export AWS_ACCESS_KEY_ID=AKIA_DEPLOYMENT...
export AWS_SECRET_ACCESS_KEY=...

# Test Lambda access
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `gitlab-ec2`)].FunctionName'

# Test IAM access
aws iam get-role --role-name GitLabEC2SchedulerLambdaRole 2>&1 | grep -q "NoSuchEntity" && echo "✓ Can query IAM" || echo "✗ Cannot query IAM"
```

### Test Runtime Permissions

```bash
# Set runtime credentials
export AWS_ACCESS_KEY_ID=AKIA_RUNTIME...
export AWS_SECRET_ACCESS_KEY=...

# Test EC2 access
aws ec2 describe-instances --instance-ids i-YOUR_INSTANCE_ID --query 'Reservations[0].Instances[0].State.Name'

# Test EventBridge access
aws events describe-rule --name gitlab-ec2-start-weekday --query 'State'

# Test Cost Explorer access
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '1 day ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --query 'ResultsByTime[0].Total.UnblendedCost.Amount'
```

## Common Issues

### "Access Denied" during deployment

**Cause:** Missing deployment permissions

**Fix:**
```bash
# Verify deployment policy is attached
aws iam list-attached-user-policies --user-name YOUR_USERNAME

# Attach deployment policy
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam attach-user-policy \
  --user-name YOUR_USERNAME \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy
```

### "Access Denied" during API operations

**Cause:** Missing runtime permissions

**Fix:**
```bash
# Attach runtime policy
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws iam attach-user-policy \
  --user-name YOUR_USERNAME \
  --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy
```

### Cost Explorer access denied

**Cause:** Cost Explorer not enabled

**Fix:**
1. Go to AWS Console → Billing → Cost Explorer
2. Click "Enable Cost Explorer"
3. Wait 24 hours for data to populate

## Security Best Practices

### 1. Use Least Privilege

✅ **Do:**
- Use separate deployment and runtime policies
- Disable deployment user after setup
- Use instance profiles for production

❌ **Don't:**
- Give `AdministratorAccess`
- Use root account credentials
- Share access keys

### 2. Rotate Access Keys

Rotate every 90 days:

```bash
# Create new key
aws iam create-access-key --user-name YOUR_USERNAME

# Update backend/.env with new key

# Delete old key
aws iam delete-access-key \
  --user-name YOUR_USERNAME \
  --access-key-id OLD_KEY_ID
```

### 3. Enable CloudTrail

Audit all API calls:

```bash
aws cloudtrail create-trail \
  --name ec2-dashboard-audit \
  --s3-bucket-name your-cloudtrail-bucket
```

### 4. Use MFA for Deployment User

```bash
aws iam enable-mfa-device \
  --user-name ec2-dashboard-deployer \
  --serial-number arn:aws:iam::ACCOUNT_ID:mfa/ec2-dashboard-deployer \
  --authentication-code-1 123456 \
  --authentication-code-2 789012
```

## Quick Reference

### Policy Files
- `iam_deployment_policy.json` - For Lambda deployment
- `iam_runtime_policy.json` - For dashboard API
- `iam_policy.json` - Legacy combined policy (deprecated)

### Scripts
- `create_iam_user.sh` - Automated IAM user creation
- `deploy_lambdas.sh` - Deploy Lambda functions (needs deployment permissions)
- `update_lambda_instance.sh` - Update instance ID (needs runtime permissions)

### Documentation
- `IAM_USER_SETUP.md` - Detailed manual setup guide
- `IAM_PERMISSIONS_SUMMARY.md` - This file
- `LAMBDA_DEPLOYMENT.md` - Lambda deployment guide

## Recommended Setup by Environment

| Environment | Recommended Setup | Credentials |
|-------------|-------------------|-------------|
| Development | Single user | Access keys in .env |
| Staging | Separate users | Runtime keys in .env |
| Production | Instance profile | No keys (instance profile) |

## Next Steps

1. **Create IAM user**: Run `./create_iam_user.sh`
2. **Deploy Lambda**: Run `./deploy_lambdas.sh`
3. **Configure backend**: Add credentials to `.env`
4. **Test**: Verify permissions work
5. **Secure**: Disable deployment user after setup

For detailed instructions, see [IAM_USER_SETUP.md](infra/IAM_USER_SETUP.md).
