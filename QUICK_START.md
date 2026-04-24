# Quick Start Guide - EC2 Scheduler Dashboard

## 🚀 Get Started in 5 Minutes

### Step 1: Configure AWS Connection

Run the interactive setup script:

```bash
cd ec2-dashboard
./setup_aws_config.sh
```

This will guide you through:
- Setting AWS credentials
- Configuring EC2 instance ID
- Setting up GitLab host details
- Generating API key
- Configuring SSL monitoring

**OR** manually edit `backend/.env` with your AWS details.

### Step 2: Test AWS Connectivity

```bash
python backend/test_aws_connection.py
```

This diagnostic tool will check:
- ✓ AWS credentials are valid
- ✓ EC2 instance is accessible
- ✓ EventBridge rules exist
- ✓ CloudWatch metrics available
- ✓ Cost Explorer enabled
- ✓ SNS topic configured

**Fix any errors before proceeding!** See `AWS_SETUP_GUIDE.md` for solutions.

### Step 3: Install Dependencies

```bash
# Create virtual environment (optional but recommended)
python -m venv backend/venv
source backend/venv/bin/activate  # On Windows: backend\venv\Scripts\activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

### Step 4: Start the Backend

```bash
# From ec2-dashboard directory
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### Step 5: Test the API

Open a new terminal and test:

```bash
# Health check (no auth)
curl http://localhost:8000/health
# Expected: {"status":"ok"}

# EC2 status (with auth)
curl -H "X-API-Key: your-api-key-from-env" http://localhost:8000/api/status
# Expected: JSON with instance details
```

### Step 6: Start the Frontend

```bash
# In a new terminal
cd ec2-dashboard/frontend-react
npm install
npm run dev
```

Open browser to: `http://localhost:5173`

Enter your API key when prompted (from `DASHBOARD_API_KEY` in `.env`)

## ✅ Verification Checklist

- [ ] Backend starts without errors
- [ ] `/health` endpoint returns `{"status":"ok"}`
- [ ] `/api/status` returns EC2 instance details
- [ ] Frontend loads in browser
- [ ] Dashboard shows instance status
- [ ] All 8 cards display data (or show appropriate errors)
- [ ] Start/Stop buttons work (if instance is in correct state)

## 🔧 Common Issues

### Issue: "No credentials found"

**Solution:** Set AWS credentials in `backend/.env`:
```bash
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

OR use IAM instance profile if running on EC2.

### Issue: "Instance i-0xxxxxxxxxxxxxxx not found"

**Solution:** Update `EC2_INSTANCE_ID` in `backend/.env` with your actual instance ID:
```bash
# Find your instance ID
aws ec2 describe-instances --region ap-south-1 --query 'Reservations[*].Instances[*].[InstanceId,Tags[?Key==`Name`].Value|[0]]' --output table

# Update .env
EC2_INSTANCE_ID=i-0123456789abcdef0
```

### Issue: "EventBridge rule not found"

**Solution:** EventBridge rules are optional for initial testing. To create them:
```bash
aws events put-rule --name gitlab-ec2-start-weekday --schedule-expression "cron(30 3 ? * MON-SAT *)" --state ENABLED --region ap-south-1
aws events put-rule --name gitlab-ec2-stop-weekday --schedule-expression "cron(30 15 ? * MON-SAT *)" --state ENABLED --region ap-south-1
```

### Issue: "Permission denied" errors

**Solution:** Ensure your IAM user/role has required permissions. Apply policy from `infra/iam_policy.json`:
```bash
aws iam create-policy --policy-name EC2DashboardPolicy --policy-document file://infra/iam_policy.json
aws iam attach-user-policy --user-name your-username --policy-arn arn:aws:iam::ACCOUNT:policy/EC2DashboardPolicy
```

### Issue: Frontend shows "401 Unauthorized"

**Solution:** Check API key:
1. Verify `DASHBOARD_API_KEY` is set in `backend/.env`
2. Clear browser localStorage: `localStorage.clear()`
3. Refresh page and enter correct API key

### Issue: Dashboard shows "N/A" for all data

**Solution:**
1. Check backend is running: `curl http://localhost:8000/health`
2. Check browser console (F12) for errors
3. Verify API key is correct
4. Run diagnostic: `python backend/test_aws_connection.py`

## 📚 Next Steps

### For Development

1. ✅ Backend and frontend running locally
2. ✅ AWS connectivity working
3. ✅ Dashboard displays data
4. 📖 Read `AWS_SETUP_GUIDE.md` for detailed configuration
5. 🧪 Test start/stop functionality
6. 📊 Monitor SSL certificates and disk usage
7. 💰 Track costs

### For Production Deployment

1. 📋 Complete deployment checklist in `tasks.md` (Task 12-14)
2. 🔒 Set up nginx reverse proxy with HTTPS
3. 🔐 Configure systemd service for auto-start
4. 🎯 Create EventBridge rules for scheduling
5. 📢 Set up SNS topic for alerts
6. 🔑 Use IAM instance profile instead of access keys
7. 🛡️ Apply security hardening (Task 16)

## 📖 Documentation

- `AWS_SETUP_GUIDE.md` - Detailed AWS configuration guide
- `.kiro/specs/ec2-scheduler-dashboard/requirements.md` - Feature requirements
- `.kiro/specs/ec2-scheduler-dashboard/design.md` - Technical design
- `.kiro/specs/ec2-scheduler-dashboard/tasks.md` - Implementation tasks
- `infra/iam_policy.json` - Required IAM permissions
- `infra/eventbridge_rules.json` - Schedule rule definitions

## 🆘 Getting Help

1. **Run diagnostics:** `python backend/test_aws_connection.py`
2. **Check logs:** Run backend with `--log-level debug`
3. **Check browser console:** Press F12 in browser
4. **Review guides:** See `AWS_SETUP_GUIDE.md`
5. **Check IAM permissions:** Compare with `infra/iam_policy.json`

## 🎯 What You Can Do

Once everything is running:

- ✅ **Monitor** EC2 instance status in real-time
- ✅ **Control** instance with start/stop buttons
- ✅ **Schedule** automated start/stop times
- ✅ **Track** SSL certificate expiry
- ✅ **Monitor** disk usage on GitLab
- ✅ **View** CPU credit balance
- ✅ **Track** monthly costs and projections
- ✅ **Receive** alerts for critical conditions

## 💡 Tips

- Use keyboard shortcuts: `R` to refresh, `S` to start (when stopped)
- Dashboard auto-refreshes every 30 seconds
- Stop action requires confirmation to prevent accidents
- SSL and disk alerts appear as banners when thresholds exceeded
- Cost projection helps track against ₹1,600/month target

---

**Ready to deploy?** See `tasks.md` for production deployment checklist.

**Need help?** Check `AWS_SETUP_GUIDE.md` for troubleshooting.
