# Production Deployment Guide

## URLs

- **Frontend**: https://gitmonit.intelligence.app
- **Backend API**: https://backendec2.intelligence.app

## Backend Deployment

### 1. Server Setup

```bash
# Clone repository
cd /var/www/html
git clone https://github.com/jakhadakash/sechudleec2.git
cd sechudleec2

# Setup Python environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment

Create `backend/.env`:

```bash
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
EC2_INSTANCE_ID=i-0a317eb53175195bf
GITLAB_HOST=mygitlab.idealittechno.in
SSH_KEY_PATH=/home/ubuntu/.ssh/id_rsa
DASHBOARD_API_KEY=your_secure_api_key
SNS_TOPIC_ARN=arn:aws:sns:ap-south-1:ACCOUNT:gitlab-alerts
EVENTBRIDGE_RULE_STOP=gitlab-ec2-stop-weekday
EVENTBRIDGE_RULE_START=gitlab-ec2-start-weekday
LAMBDA_START_ARN=arn:aws:lambda:ap-south-1:720712330515:function:gitlab-ec2-start
LAMBDA_STOP_ARN=arn:aws:lambda:ap-south-1:720712330515:function:gitlab-ec2-stop
SSL_DOMAINS=mygitlab.idealittechno.in
```

### 3. Run Backend

**Option A: Systemd Service (Recommended)**

Create `/etc/systemd/system/ec2-dashboard-backend.service`:

```ini
[Unit]
Description=EC2 Scheduler Dashboard Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/html/sechudleec2/backend
Environment="PATH=/var/www/html/sechudleec2/backend/venv/bin"
ExecStart=/var/www/html/sechudleec2/backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ec2-dashboard-backend
sudo systemctl start ec2-dashboard-backend
sudo systemctl status ec2-dashboard-backend
```

**Option B: Manual (Development)**

```bash
cd /var/www/html/sechudleec2/backend
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### 4. Nginx Configuration for Backend

Create `/etc/nginx/sites-available/backendec2.intelligence.app`:

```nginx
server {
    listen 80;
    server_name backendec2.intelligence.app;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/backendec2.intelligence.app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d backendec2.intelligence.app
```

## Frontend Deployment

### 1. Build Frontend

```bash
cd /var/www/html/sechudleec2/frontend-react

# Install dependencies (requires Node.js 20+)
npm install

# Build for production
npm run build
```

This creates a `dist/` folder with optimized static files.

### 2. Nginx Configuration for Frontend

Create `/etc/nginx/sites-available/gitmonit.intelligence.app`:

```nginx
server {
    listen 80;
    server_name gitmonit.intelligence.app;
    root /var/www/html/sechudleec2/frontend-react/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/gitmonit.intelligence.app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d gitmonit.intelligence.app
```

## Environment Variables

### Frontend (.env.production)

```
VITE_API_URL=https://backendec2.intelligence.app
```

### Backend (.env)

See Backend Deployment section above.

## Deployment Workflow

### Initial Deployment

```bash
# Backend
cd /var/www/html/sechudleec2
git pull origin main
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart ec2-dashboard-backend

# Frontend
cd /var/www/html/sechudleec2/frontend-react
npm install
npm run build
sudo systemctl reload nginx
```

### Updates

```bash
# Pull latest code
cd /var/www/html/sechudleec2
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart ec2-dashboard-backend

# Update frontend
cd ../frontend-react
npm install
npm run build
# No need to reload nginx - just replace dist files
```

## Verification

### Backend Health Check

```bash
curl https://backendec2.intelligence.app/health
# Should return: {"status":"ok"}
```

### Frontend Access

Open browser: https://gitmonit.intelligence.app

### API Test

```bash
curl -H "X-API-Key: YOUR_KEY" https://backendec2.intelligence.app/api/status
```

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
sudo journalctl -u ec2-dashboard-backend -f

# Check if port is in use
sudo netstat -tlnp | grep 8000

# Test manually
cd /var/www/html/sechudleec2/backend
source venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Frontend Not Loading

```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Verify dist folder exists
ls -la /var/www/html/sechudleec2/frontend-react/dist/

# Check nginx config
sudo nginx -t
```

### CORS Errors

Make sure backend CORS settings include frontend domain:
- `https://gitmonit.intelligence.app`

### API Connection Failed

1. Check backend is running: `sudo systemctl status ec2-dashboard-backend`
2. Check nginx proxy: `curl http://127.0.0.1:8000/health`
3. Check SSL certificate: `sudo certbot certificates`
4. Check firewall: `sudo ufw status`

## Security Checklist

- [ ] Backend API key is strong and secure
- [ ] AWS credentials are properly secured in .env
- [ ] .env files are not committed to git
- [ ] SSL certificates are installed and auto-renewing
- [ ] Firewall allows only necessary ports (80, 443)
- [ ] Backend systemd service runs as www-data (not root)
- [ ] SSH keys have proper permissions (600)
- [ ] CORS is restricted to frontend domain only

## Monitoring

### Backend Logs

```bash
# Real-time logs
sudo journalctl -u ec2-dashboard-backend -f

# Last 100 lines
sudo journalctl -u ec2-dashboard-backend -n 100

# Logs from today
sudo journalctl -u ec2-dashboard-backend --since today
```

### Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Audit Logs

```bash
# View audit log
cat /var/www/html/sechudleec2/backend/audit_log.json | jq

# Via API
curl -H "X-API-Key: YOUR_KEY" https://backendec2.intelligence.app/api/audit | jq
```

## Backup

### Important Files to Backup

- `/var/www/html/sechudleec2/backend/.env`
- `/var/www/html/sechudleec2/backend/audit_log.json`
- `/etc/nginx/sites-available/backendec2.intelligence.app`
- `/etc/nginx/sites-available/gitmonit.intelligence.app`
- `/etc/systemd/system/ec2-dashboard-backend.service`

### Backup Script

```bash
#!/bin/bash
BACKUP_DIR="/backup/ec2-dashboard-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

cp /var/www/html/sechudleec2/backend/.env $BACKUP_DIR/
cp /var/www/html/sechudleec2/backend/audit_log.json $BACKUP_DIR/
cp /etc/nginx/sites-available/backendec2.intelligence.app $BACKUP_DIR/
cp /etc/nginx/sites-available/gitmonit.intelligence.app $BACKUP_DIR/
cp /etc/systemd/system/ec2-dashboard-backend.service $BACKUP_DIR/

tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR
echo "Backup created: $BACKUP_DIR.tar.gz"
```

## Performance Optimization

### Frontend

- Static assets are cached for 1 year
- Gzip compression enabled in nginx
- Minified and bundled by Vite

### Backend

- Use systemd for automatic restart
- Consider using gunicorn with multiple workers for high traffic
- Enable nginx caching for API responses if needed

## SSL Certificate Renewal

Certbot auto-renews certificates. Verify:

```bash
sudo certbot renew --dry-run
```

Check renewal timer:

```bash
sudo systemctl status certbot.timer
```
