# Lambda Integration FAQ

## General Questions

### Q: What IAM permissions do I need?

**A:** You need TWO sets of permissions:

1. **Deployment permissions** - For running `deploy_lambdas.sh` (one-time)
2. **Runtime permissions** - For dashboard API operations (ongoing)

**Quick setup:**
```bash
cd ec2-dashboard/infra
./create_iam_user.sh
```

See [IAM_PERMISSIONS_SUMMARY.md](IAM_PERMISSIONS_SUMMARY.md) for detailed breakdown.

### Q: Can I use one IAM user for both deployment and runtime?

**A:** Yes! Use option 1 in `create_iam_user.sh`. This creates a single user with both policies attached. Good for development, but for production consider using separate users or an instance profile.

### Q: Why do I need Lambda functions?

**A:** Lambda functions are the "executors" that EventBridge calls on schedule to actually start/stop your EC2 instance. Without Lambda targets, EventBridge rules are just schedules with no action.

### Q: Can I use the dashboard without Lambda functions?

**A:** Yes! The dashboard's manual start/stop buttons work independently through the backend API. Lambda functions are only needed for automated scheduling.

### Q: How much do Lambda functions cost?

**A:** Less than $0.01/month. With 2 invocations per day (60/month), you're well within AWS free tier (1M requests/month).

## Configuration Questions

### Q: Can I update the EC2 instance ID later through .env?

**A:** Yes, but you need to update it in TWO places:

1. **Backend .env** - For dashboard API (manual start/stop buttons)
2. **Lambda environment** - For scheduled automation

**Quick way:**
```bash
# 1. Edit backend/.env
EC2_INSTANCE_ID=i-NEW_INSTANCE_ID

# 2. Update Lambda functions
cd ec2-dashboard/infra
./update_lambda_instance.sh

# 3. Restart backend
```

The `update_lambda_instance.sh` script reads from your `.env` and updates both Lambda functions automatically.

### Q: Why are there two separate configurations?

**A:** 
- **Backend API**: Runs on your server, reads `.env` directly
- **Lambda functions**: Run in AWS, have their own environment variables

They're separate services, so each needs its own configuration. The update script keeps them in sync.

### Q: Do I need to restart anything after updating Lambda?

**A:** 
- **Lambda functions**: No restart needed, changes take effect immediately
- **Backend API**: Yes, restart to load new `.env` values

### Q: What if I only update .env but forget to update Lambda?

**A:** 
- Manual start/stop (dashboard buttons) will work with new instance
- Scheduled automation will still target the old instance
- Run `./update_lambda_instance.sh` to sync them

## Deployment Questions

### Q: Do I need to deploy Lambda functions manually?

**A:** No, use the automated script:
```bash
cd ec2-dashboard/infra
./deploy_lambdas.sh
```

It handles everything: IAM roles, Lambda deployment, EventBridge permissions, and target configuration.

### Q: Can I deploy to multiple regions?

**A:** Yes, but you need to:
1. Deploy Lambda functions in each region
2. Create EventBridge rules in each region
3. Update `.env` with region-specific Lambda ARNs

### Q: What if deployment fails?

**A:** Common issues:
- **IAM permissions**: Ensure you have `lambda:CreateFunction` permission
- **Role propagation**: Wait 10 seconds after creating IAM role
- **Function exists**: Use update mode or delete existing functions first

Check CloudWatch logs for detailed error messages.

## Scheduling Questions

### Q: How do I change the schedule?

**A:** Three ways:

1. **Dashboard UI**: Use the Edit Schedule card
2. **API**: POST to `/api/schedule` endpoint
3. **AWS Console**: EventBridge → Rules → Edit

### Q: Can I have different schedules for different days?

**A:** Yes! The default setup has:
- Weekday schedule (Mon-Sat)
- Weekend schedule (Sunday off)

You can create additional rules for holidays, maintenance windows, etc.

### Q: What timezone are schedules in?

**A:** EventBridge uses UTC. The default schedules are:
- Start: 3:30 UTC = 9:00am IST
- Stop: 15:30 UTC = 9:00pm IST

Convert your local time to UTC when setting schedules.

## Override Questions

### Q: How do I prevent automated stop during maintenance?

**A:** Add a tag to your EC2 instance:
```bash
aws ec2 create-tags \
  --resources i-YOUR_INSTANCE_ID \
  --tags Key=no-auto-stop,Value=true
```

Lambda will check this tag and skip the stop action.

### Q: How do I remove the override?

**A:** Delete the tag:
```bash
aws ec2 delete-tags \
  --resources i-YOUR_INSTANCE_ID \
  --tags Key=no-auto-stop
```

### Q: Can I override start actions too?

**A:** Yes, use the `no-auto-start` tag:
```bash
aws ec2 create-tags \
  --resources i-YOUR_INSTANCE_ID \
  --tags Key=no-auto-start,Value=true
```

## Troubleshooting Questions

### Q: Lambda doesn't execute on schedule. Why?

**A:** Check these in order:

1. **EventBridge rule enabled?**
   ```bash
   aws events describe-rule --name gitlab-ec2-start-weekday
   ```

2. **Lambda target configured?**
   ```bash
   aws events list-targets-by-rule --rule gitlab-ec2-start-weekday
   ```

3. **Lambda has EventBridge permission?**
   ```bash
   aws lambda get-policy --function-name gitlab-ec2-start
   ```

4. **Check CloudWatch logs:**
   ```bash
   aws logs tail /aws/lambda/gitlab-ec2-start --follow
   ```

### Q: Instance doesn't start/stop even though Lambda executes. Why?

**A:** Check:

1. **Correct instance ID in Lambda?**
   ```bash
   aws lambda get-function-configuration --function-name gitlab-ec2-start \
     --query 'Environment.Variables.EC2_INSTANCE_ID'
   ```

2. **Lambda has EC2 permissions?**
   - Check IAM role attached to Lambda
   - Verify role has `ec2:StartInstances` and `ec2:StopInstances`

3. **Override tag present?**
   ```bash
   aws ec2 describe-tags --filters "Name=resource-id,Values=i-YOUR_INSTANCE_ID"
   ```

4. **Check Lambda CloudWatch logs** for error messages

### Q: Graceful shutdown doesn't work. Why?

**A:** Check:

1. **SSM agent running on instance?**
   ```bash
   aws ssm describe-instance-information --filters "Key=InstanceIds,Values=i-YOUR_INSTANCE_ID"
   ```

2. **Shutdown script exists?**
   ```bash
   ssh ubuntu@your-instance "ls -la /opt/gitlab/scripts/graceful_shutdown.sh"
   ```

3. **Lambda has SSM permissions?**
   - Check IAM role has `ssm:SendCommand`

4. **Instance has SSM permissions?**
   - Instance profile needs `AmazonSSMManagedInstanceCore` policy

### Q: How do I view Lambda execution logs?

**A:** 
```bash
# Real-time logs
aws logs tail /aws/lambda/gitlab-ec2-start --follow

# Last 10 minutes
aws logs tail /aws/lambda/gitlab-ec2-start --since 10m

# Specific time range
aws logs tail /aws/lambda/gitlab-ec2-start \
  --since 2024-01-01T00:00:00 \
  --until 2024-01-01T23:59:59
```

## Security Questions

### Q: Are Lambda functions secure?

**A:** Yes, they follow AWS best practices:
- Use IAM roles (no hardcoded credentials)
- Least-privilege permissions
- CloudWatch logging for audit trail
- VPC isolation (optional)

### Q: Can someone else trigger my Lambda functions?

**A:** No, only EventBridge rules in your account can invoke them (configured via Lambda resource policy).

### Q: Should I use access keys or IAM roles?

**A:** 
- **Lambda functions**: Always use IAM roles (automatic)
- **Backend API**: Use IAM instance profile if running on EC2, otherwise access keys

### Q: How do I audit Lambda executions?

**A:** 
1. **CloudWatch Logs**: Every execution is logged
2. **CloudTrail**: Tracks Lambda API calls
3. **EventBridge metrics**: Shows invocation counts

## Cost Questions

### Q: What's the total cost?

**A:** 
- **Lambda**: < $0.01/month (within free tier)
- **EventBridge**: Free (no charge for rules)
- **CloudWatch Logs**: ~$0.50/month (5MB logs)
- **Total**: < $1/month

### Q: Does Lambda cost increase with more schedules?

**A:** Slightly. Each additional schedule = 2 more invocations/day. Still well within free tier unless you have 100+ schedules.

### Q: Are there any hidden costs?

**A:** No hidden costs, but consider:
- CloudWatch Logs retention (default 7 days)
- Data transfer if Lambda is in different region than EC2
- SSM command executions (free tier: 100,000/month)

## Advanced Questions

### Q: Can I use these Lambda functions with multiple instances?

**A:** Not directly. Each Lambda function targets one instance. For multiple instances:

1. **Option A**: Deploy separate Lambda functions per instance
2. **Option B**: Modify Lambda to accept instance ID as input parameter
3. **Option C**: Use AWS Instance Scheduler (AWS solution)

### Q: Can I add custom logic to Lambda functions?

**A:** Yes! Edit `lambda_ec2_start.py` or `lambda_ec2_stop.py`, then redeploy:
```bash
cd ec2-dashboard/infra
zip lambda_ec2_start.zip lambda_ec2_start.py
aws lambda update-function-code \
  --function-name gitlab-ec2-start \
  --zip-file fileb://lambda_ec2_start.zip
```

### Q: Can I use Step Functions instead of Lambda?

**A:** Yes, but Lambda is simpler and cheaper for this use case. Step Functions add complexity without significant benefit.

### Q: Can I trigger Lambda from other sources?

**A:** Yes! Lambda functions can be invoked by:
- EventBridge (current setup)
- API Gateway (for webhooks)
- SNS/SQS (for event-driven)
- Manual invocation (for testing)

### Q: How do I test Lambda without waiting for schedule?

**A:** Invoke manually:
```bash
aws lambda invoke \
  --function-name gitlab-ec2-start \
  /tmp/response.json

cat /tmp/response.json
```

## Migration Questions

### Q: I'm already using cron on EC2. Should I migrate?

**A:** Benefits of Lambda approach:
- ✅ Works even if EC2 is stopped
- ✅ No maintenance (serverless)
- ✅ Better logging and monitoring
- ✅ Centralized scheduling

Stick with cron if:
- ❌ You need complex scheduling logic
- ❌ You're already comfortable with cron
- ❌ You want to avoid AWS Lambda

### Q: Can I run both cron and Lambda?

**A:** Yes, but disable one to avoid conflicts. Use override tags to prevent Lambda from interfering with manual operations.

## Support

### Q: Where can I get help?

**A:** 
1. Check this FAQ
2. Review `LAMBDA_DEPLOYMENT.md` for detailed guide
3. Check CloudWatch logs for errors
4. Review `LAMBDA_INTEGRATION_SUMMARY.md` for architecture
5. Test Lambda functions manually to isolate issues

### Q: How do I report a bug?

**A:** 
1. Check CloudWatch logs for error details
2. Verify configuration (instance ID, IAM permissions)
3. Test Lambda manually to reproduce
4. Document steps to reproduce
