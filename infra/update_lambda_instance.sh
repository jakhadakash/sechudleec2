#!/bin/bash
# Update EC2 Instance ID in Lambda function environment variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Update Lambda EC2 Instance ID${NC}"
echo "================================"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Get current AWS region
AWS_REGION=${AWS_REGION:-ap-south-1}

# Check if .env file exists
if [ -f "../backend/.env" ]; then
    echo "Reading configuration from backend/.env..."
    # Source the .env file to get EC2_INSTANCE_ID
    export $(grep -v '^#' ../backend/.env | grep EC2_INSTANCE_ID | xargs)
    export $(grep -v '^#' ../backend/.env | grep AWS_REGION | xargs)
    AWS_REGION=${AWS_REGION:-ap-south-1}
fi

# Prompt for instance ID if not in .env
if [ -z "$EC2_INSTANCE_ID" ]; then
    read -p "Enter new EC2 Instance ID: " EC2_INSTANCE_ID
    if [ -z "$EC2_INSTANCE_ID" ]; then
        echo -e "${RED}Error: EC2 Instance ID is required${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Found EC2_INSTANCE_ID in .env: $EC2_INSTANCE_ID"
    read -p "Use this instance ID? (y/n): " USE_ENV
    if [ "$USE_ENV" != "y" ]; then
        read -p "Enter new EC2 Instance ID: " EC2_INSTANCE_ID
    fi
fi

# Prompt for region
read -p "Enter AWS region [$AWS_REGION]: " INPUT_REGION
AWS_REGION=${INPUT_REGION:-$AWS_REGION}

echo ""
echo "Updating Lambda functions with:"
echo "  Instance ID: $EC2_INSTANCE_ID"
echo "  Region: $AWS_REGION"
echo ""

# Update START Lambda
echo "Updating gitlab-ec2-start..."
START_RESULT=$(aws lambda update-function-configuration \
  --function-name gitlab-ec2-start \
  --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID}}" \
  --region ${AWS_REGION} 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Updated gitlab-ec2-start"
else
    if echo "$START_RESULT" | grep -q "ResourceNotFoundException"; then
        echo -e "${YELLOW}⚠${NC} gitlab-ec2-start function not found (not deployed yet)"
    else
        echo -e "${RED}✗${NC} Failed to update gitlab-ec2-start: $START_RESULT"
    fi
fi

# Update STOP Lambda
echo "Updating gitlab-ec2-stop..."
STOP_RESULT=$(aws lambda update-function-configuration \
  --function-name gitlab-ec2-stop \
  --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID},GRACEFUL_SHUTDOWN_SCRIPT=bash /opt/gitlab/scripts/graceful_shutdown.sh}" \
  --region ${AWS_REGION} 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Updated gitlab-ec2-stop"
else
    if echo "$STOP_RESULT" | grep -q "ResourceNotFoundException"; then
        echo -e "${YELLOW}⚠${NC} gitlab-ec2-stop function not found (not deployed yet)"
    else
        echo -e "${RED}✗${NC} Failed to update gitlab-ec2-stop: $STOP_RESULT"
    fi
fi

echo ""
echo -e "${GREEN}Update complete!${NC}"
echo ""
echo "Note: The backend .env EC2_INSTANCE_ID is used for direct API calls."
echo "Lambda functions now have their own copy of the instance ID."
echo ""
echo "To test the updated Lambda functions:"
echo "  aws lambda invoke --function-name gitlab-ec2-start --region ${AWS_REGION} /tmp/start.json"
echo "  aws lambda invoke --function-name gitlab-ec2-stop --region ${AWS_REGION} /tmp/stop.json"
echo ""
