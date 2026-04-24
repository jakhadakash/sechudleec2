#!/bin/bash
# Create EventBridge rules for EC2 scheduling

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}EventBridge Rules Setup${NC}"
echo "======================="
echo ""

# Get configuration
AWS_REGION=${AWS_REGION:-ap-south-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Unable to get AWS account ID. Check your AWS credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} AWS Account ID: $ACCOUNT_ID"
echo -e "${GREEN}✓${NC} Region: $AWS_REGION"
echo ""

# Create weekday start rule
echo "Creating gitlab-ec2-start-weekday rule..."
aws events put-rule \
  --name gitlab-ec2-start-weekday \
  --schedule-expression "cron(30 3 ? * MON-SAT *)" \
  --description "Start GitLab EC2 at 9:00am IST (03:30 UTC) Mon-Sat" \
  --state ENABLED \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "${GREEN}✓${NC} Created gitlab-ec2-start-weekday"

# Create weekday stop rule
echo "Creating gitlab-ec2-stop-weekday rule..."
aws events put-rule \
  --name gitlab-ec2-stop-weekday \
  --schedule-expression "cron(30 15 ? * MON-SAT *)" \
  --description "Stop GitLab EC2 at 9:00pm IST (15:30 UTC) Mon-Sat" \
  --state ENABLED \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "${GREEN}✓${NC} Created gitlab-ec2-stop-weekday"

# Add Lambda targets
echo ""
echo "Configuring Lambda targets..."

aws events put-targets \
  --rule gitlab-ec2-start-weekday \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-start" \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "${GREEN}✓${NC} Configured target for gitlab-ec2-start-weekday"

aws events put-targets \
  --rule gitlab-ec2-stop-weekday \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-stop" \
  --region ${AWS_REGION} \
  > /dev/null

echo -e "${GREEN}✓${NC} Configured target for gitlab-ec2-stop-weekday"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}EventBridge Rules Created!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Rules created:"
echo "  • gitlab-ec2-start-weekday: Mon-Sat 9:00am IST (3:30 UTC)"
echo "  • gitlab-ec2-stop-weekday: Mon-Sat 9:00pm IST (15:30 UTC)"
echo ""
echo "Verify rules:"
echo "  aws events describe-rule --name gitlab-ec2-start-weekday --region ${AWS_REGION}"
echo "  aws events describe-rule --name gitlab-ec2-stop-weekday --region ${AWS_REGION}"
echo ""
echo "Verify targets:"
echo "  aws events list-targets-by-rule --rule gitlab-ec2-start-weekday --region ${AWS_REGION}"
echo "  aws events list-targets-by-rule --rule gitlab-ec2-stop-weekday --region ${AWS_REGION}"
echo ""
echo "Test Lambda functions:"
echo "  aws lambda invoke --function-name gitlab-ec2-start --region ${AWS_REGION} /tmp/start.json"
echo "  aws lambda invoke --function-name gitlab-ec2-stop --region ${AWS_REGION} /tmp/stop.json"
echo ""
