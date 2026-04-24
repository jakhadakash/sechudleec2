# EC2 Scheduler Dashboard Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Interface                               │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  React Dashboard (frontend-react/)                             │ │
│  │  - Status monitoring                                           │ │
│  │  - Manual start/stop controls                                  │ │
│  │  - Schedule management                                         │ │
│  │  - SSL/Disk/Cost monitoring                                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP/REST API
                                    │ (X-API-Key auth)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend (backend/)                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Routers:                                                      │ │
│  │  • /api/status      - EC2 instance status                     │ │
│  │  • /api/start       - Manual start (reads .env)               │ │
│  │  • /api/stop        - Manual stop (reads .env)                │ │
│  │  • /api/schedule    - EventBridge schedule management         │ │
│  │  • /api/ssl         - SSL certificate monitoring              │ │
│  │  • /api/disk        - Disk usage via SSH                      │ │
│  │  • /api/cost        - Cost Explorer data                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Configuration: backend/.env                                         │
│  • EC2_INSTANCE_ID ← Used by manual start/stop                      │
│  • LAMBDA_START_ARN ← Used to configure EventBridge targets         │
│  • LAMBDA_STOP_ARN ← Used to configure EventBridge targets          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │   AWS EC2    │  │ EventBridge  │  │ Other AWS    │
        │              │  │              │  │ Services     │
        │ • Describe   │  │ • Get rules  │  │ • CloudWatch │
        │ • Start      │  │ • Update     │  │ • Cost Exp.  │
        │ • Stop       │  │ • Configure  │  │ • SNS        │
        │ • Tags       │  │   targets    │  │ • SSM        │
        └──────────────┘  └──────────────┘  └──────────────┘
                                    │
                                    │ Scheduled triggers
                                    │ (cron expressions)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AWS Lambda Functions                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────┐ │
│  │  gitlab-ec2-start              │  │  gitlab-ec2-stop           │ │
│  │                                │  │                            │ │
│  │  Env: EC2_INSTANCE_ID          │  │  Env: EC2_INSTANCE_ID      │ │
│  │       (separate from .env)     │  │       GRACEFUL_SHUTDOWN... │ │
│  │                                │  │                            │ │
│  │  1. Check instance state       │  │  1. Check instance state   │ │
│  │  2. Check no-auto-start tag    │  │  2. Check no-auto-stop tag │ │
│  │  3. Call ec2.start_instances() │  │  3. SSM graceful shutdown  │ │
│  │  4. Log to CloudWatch          │  │  4. Wait 10 seconds        │ │
│  │                                │  │  5. Call ec2.stop_instances│ │
│  │                                │  │  6. Log to CloudWatch      │ │
│  └────────────────────────────────┘  └────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ EC2 API calls
                                    ▼
                        ┌──────────────────────┐
                        │   Target EC2         │
                        │   Instance           │
                        │                      │
                        │   • GitLab Server    │
                        │   • SSM Agent        │
                        │   • Graceful         │
                        │     Shutdown Script  │
                        └──────────────────────┘
```

## Data Flow: Manual Start/Stop

```
User clicks "Start" button
    ↓
React Dashboard
    ↓ POST /api/start
FastAPI Backend
    ↓ reads EC2_INSTANCE_ID from .env
    ↓ boto3.client('ec2')
AWS EC2 API
    ↓ start_instances()
EC2 Instance starts
    ↓
Dashboard polls /api/status
    ↓ shows "running"
User sees updated status
```

## Data Flow: Scheduled Start/Stop

```
EventBridge Rule triggers (cron schedule)
    ↓
Lambda Function invoked
    ↓ reads EC2_INSTANCE_ID from Lambda environment
    ↓ boto3.client('ec2')
AWS EC2 API
    ↓ start_instances() or stop_instances()
EC2 Instance changes state
    ↓
Lambda logs to CloudWatch
    ↓
Dashboard polls /api/status
    ↓ shows updated state
User sees automated change
```

## Configuration Sync

```
┌─────────────────────────────────────────────────────────────────┐
│  EC2_INSTANCE_ID Configuration                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  backend/.env                    Lambda Environment Variables   │
│  ┌──────────────────┐            ┌──────────────────┐          │
│  │ EC2_INSTANCE_ID  │            │ EC2_INSTANCE_ID  │          │
│  │ = i-abc123       │            │ = i-abc123       │          │
│  └──────────────────┘            └──────────────────┘          │
│         │                                  │                    │
│         │                                  │                    │
│         ▼                                  ▼                    │
│  Manual start/stop              Scheduled start/stop           │
│  (dashboard buttons)            (EventBridge triggers)         │
│                                                                  │
│  To keep in sync:                                               │
│  1. Edit backend/.env                                           │
│  2. Run ./update_lambda_instance.sh                             │
│  3. Restart backend                                             │
└─────────────────────────────────────────────────────────────────┘
```

## EventBridge Target Configuration

```
EventBridge Rule
    ├─ Name: gitlab-ec2-start-weekday
    ├─ Schedule: cron(30 3 ? * MON-SAT *)
    └─ Target: Lambda ARN
              ↓
        arn:aws:lambda:region:account:function:gitlab-ec2-start
              ↓
        Configured via:
        • deploy_lambdas.sh (initial setup)
        • update_schedule() in backend (when schedule changes)
        • POST /api/schedule/configure-targets (manual trigger)
```

## IAM Permissions Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Backend API (IAM User or Instance Profile)                     │
│  Needs:                                                          │
│  • ec2:DescribeInstances, StartInstances, StopInstances         │
│  • events:DescribeRule, PutRule, PutTargets                     │
│  • cloudwatch:GetMetricStatistics                               │
│  • ce:GetCostAndUsage                                            │
│  • sns:Publish                                                   │
│  • ssm:SendCommand                                               │
│  • lambda:InvokeFunction (for target configuration)             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Lambda Functions (IAM Role: GitLabEC2SchedulerLambdaRole)     │
│  Needs:                                                          │
│  • ec2:DescribeInstances, StartInstances, StopInstances         │
│  • ec2:DescribeTags (for override tags)                         │
│  • ssm:SendCommand (for graceful shutdown)                      │
│  • logs:CreateLogGroup, CreateLogStream, PutLogEvents           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  EventBridge (Service-Linked Role)                              │
│  Needs:                                                          │
│  • lambda:InvokeFunction (granted via Lambda resource policy)   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  EC2 Instance (Instance Profile)                                │
│  Needs:                                                          │
│  • ssm:UpdateInstanceInformation (for SSM agent)                │
│  • AmazonSSMManagedInstanceCore (managed policy)                │
└─────────────────────────────────────────────────────────────────┘
```

## Monitoring & Logging

```
┌─────────────────────────────────────────────────────────────────┐
│  CloudWatch Logs                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  /aws/lambda/gitlab-ec2-start                              │ │
│  │  • Lambda execution logs                                   │ │
│  │  • Instance state checks                                   │ │
│  │  • Tag override decisions                                  │ │
│  │  • API call results                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  /aws/lambda/gitlab-ec2-stop                               │ │
│  │  • Lambda execution logs                                   │ │
│  │  • Graceful shutdown execution                             │ │
│  │  • SSM command results                                     │ │
│  │  • API call results                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CloudWatch Metrics                                              │
│  • Lambda: Invocations, Errors, Duration                        │
│  • EventBridge: TriggeredRules, FailedInvocations               │
│  • EC2: CPUCreditBalance, StatusCheckFailed                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CloudTrail (Optional)                                           │
│  • API call audit trail                                         │
│  • Lambda invocations                                           │
│  • EC2 state changes                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Deployment Workflow

```
1. Initial Setup
   ├─ Run deploy_lambdas.sh
   │  ├─ Create IAM role
   │  ├─ Deploy Lambda functions
   │  ├─ Grant EventBridge permissions
   │  └─ Configure EventBridge targets
   │
   ├─ Update backend/.env
   │  ├─ Add LAMBDA_START_ARN
   │  └─ Add LAMBDA_STOP_ARN
   │
   └─ Restart backend

2. Update Instance ID
   ├─ Edit backend/.env
   │  └─ Change EC2_INSTANCE_ID
   │
   ├─ Run update_lambda_instance.sh
   │  ├─ Read EC2_INSTANCE_ID from .env
   │  ├─ Update gitlab-ec2-start environment
   │  └─ Update gitlab-ec2-stop environment
   │
   └─ Restart backend

3. Update Schedule
   ├─ Dashboard: Edit Schedule card
   │  └─ POST /api/schedule
   │     ├─ Update EventBridge rule
   │     └─ Reconfigure Lambda target
   │
   └─ Changes take effect immediately

4. Update Lambda Code
   ├─ Edit lambda_ec2_start.py or lambda_ec2_stop.py
   ├─ Zip updated code
   └─ aws lambda update-function-code
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Authentication & Authorization                                  │
│                                                                  │
│  Dashboard → Backend                                            │
│  • X-API-Key header (stored in sessionStorage)                 │
│  • Validated against DASHBOARD_API_KEY in .env                 │
│                                                                  │
│  Backend → AWS                                                  │
│  • IAM credentials (access keys or instance profile)           │
│  • Least-privilege IAM policy                                   │
│                                                                  │
│  EventBridge → Lambda                                           │
│  • Lambda resource policy                                       │
│  • Only allows events.amazonaws.com principal                   │
│                                                                  │
│  Lambda → AWS Services                                          │
│  • IAM role (GitLabEC2SchedulerLambdaRole)                     │
│  • Least-privilege permissions                                  │
│                                                                  │
│  Lambda → EC2 Instance                                          │
│  • SSM Session Manager (no SSH keys needed)                    │
│  • Instance profile with SSM permissions                        │
└─────────────────────────────────────────────────────────────────┘
```

## Cost Breakdown

```
Monthly Costs (Estimated)
├─ Lambda Executions
│  ├─ Invocations: 60/month (2/day)
│  ├─ Duration: ~2 seconds each
│  ├─ Memory: 128 MB
│  └─ Cost: $0.00 (within free tier)
│
├─ EventBridge Rules
│  ├─ Rules: 2 (start + stop)
│  └─ Cost: $0.00 (no charge)
│
├─ CloudWatch Logs
│  ├─ Log data: ~5 MB/month
│  ├─ Retention: 7 days
│  └─ Cost: ~$0.50
│
├─ API Calls
│  ├─ EC2 API: ~200/month
│  ├─ EventBridge API: ~100/month
│  └─ Cost: $0.00 (no charge)
│
└─ Total: < $1/month
```

## Comparison: Manual vs Automated

```
┌─────────────────────────────────────────────────────────────────┐
│  Manual Start/Stop (Dashboard Buttons)                          │
│  ✓ Immediate control                                            │
│  ✓ No Lambda needed                                             │
│  ✓ Works with just backend API                                  │
│  ✗ Requires human intervention                                  │
│  ✗ No cost savings if forgotten                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Automated Start/Stop (Lambda + EventBridge)                    │
│  ✓ Runs automatically on schedule                               │
│  ✓ Consistent cost savings (~33%)                               │
│  ✓ Works even if dashboard is down                              │
│  ✓ Override capability via tags                                 │
│  ✗ Requires Lambda deployment                                   │
│  ✗ Slightly more complex setup                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Takeaways

1. **Two Separate Systems**
   - Manual control: Backend API → EC2 (uses .env)
   - Automated control: EventBridge → Lambda → EC2 (uses Lambda env)

2. **Configuration Sync Required**
   - Changing EC2_INSTANCE_ID requires updating both places
   - Use `update_lambda_instance.sh` to keep them in sync

3. **Lambda ARNs in .env**
   - Backend needs Lambda ARNs to configure EventBridge targets
   - Only needed for schedule management, not for manual control

4. **Override Mechanism**
   - EC2 tags provide emergency override
   - Lambda checks tags before taking action
   - No backend restart needed to use overrides

5. **Monitoring**
   - CloudWatch Logs: Lambda execution details
   - Dashboard: Real-time instance status
   - EventBridge Metrics: Schedule execution tracking
