#!/bin/bash
# Quick deployment script for EC2 Scheduler Lambda functions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}EC2 Scheduler Lambda Deployment${NC}"
echo "=================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Get AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Unable to get AWS account ID. Check your AWS credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} AWS Account ID: $ACCOUNT_ID"

# Prompt for region
read -p "Enter AWS region [ap-south-1]: " AWS_REGION
AWS_REGION=${AWS_REGION:-ap-south-1}
echo -e "${GREEN}✓${NC} Using region: $AWS_REGION"

# Prompt for EC2 instance ID
read -p "Enter EC2 Instance ID: " EC2_INSTANCE_ID
if [ -z "$EC2_INSTANCE_ID" ]; then
    echo -e "${RED}Error: EC2 Instance ID is required${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Target instance: $EC2_INSTANCE_ID"

# Check if Lambda functions already exist
START_EXISTS=$(aws lambda get-function --function-name gitlab-ec2-start --region $AWS_REGION 2>/dev/null && echo "yes" || echo "no")
STOP_EXISTS=$(aws lambda get-function --function-name gitlab-ec2-stop --region $AWS_REGION 2>/dev/null && echo "yes" || echo "no")

if [ "$START_EXISTS" = "yes" ] || [ "$STOP_EXISTS" = "yes" ]; then
    echo ""
    echo -e "${YELLOW}Warning: Lambda functions already exist${NC}"
    read -p "Do you want to UPDATE existing functions? (y/n): " UPDATE_CHOICE
    if [ "$UPDATE_CHOICE" != "y" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
    UPDATE_MODE=true
else
    UPDATE_MODE=false
fi

# Change to infra directory
cd "$(dirname "$0")"

echo ""
echo "Step 1: Packaging Lambda functions..."
zip -q lambda_ec2_start.zip lambda_ec2_start.py
zip -q lambda_ec2_stop.zip lambda_ec2_stop.py
echo -e "${GREEN}✓${NC} Lambda packages created"

if [ "$UPDATE_MODE" = false ]; then
    echo ""
    echo "Step 2: Creating IAM role (if needed)..."
    
    # Check if role exists
    ROLE_EXISTS=$(aws iam get-role --role-name GitLabEC2SchedulerLambdaRole 2>/dev/null && echo "yes" || echo "no")
    
    if [ "$ROLE_EXISTS" = "no" ]; then
        # Create trust policy
        cat > /tmp/lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
        
        # Create role
        aws iam create-role \
          --role-name GitLabEC2SchedulerLambdaRole \
          --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
          > /dev/null
        
        # Attach basic execution policy
        aws iam attach-role-policy \
          --role-name GitLabEC2SchedulerLambdaRole \
          --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        
        # Create custom policy
        cat > /tmp/lambda-ec2-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": "*"
    }
  ]
}
EOF
        
        # Create and attach custom policy
        POLICY_ARN=$(aws iam create-policy \
          --policy-name GitLabEC2SchedulerLambdaPolicy \
          --policy-document file:///tmp/lambda-ec2-policy.json \
          --query 'Policy.Arn' \
          --output text 2>/dev/null || echo "arn:aws:iam::${ACCOUNT_ID}:policy/GitLabEC2SchedulerLambdaPolicy")
        
        aws iam attach-role-policy \
          --role-name GitLabEC2SchedulerLambdaRole \
          --policy-arn $POLICY_ARN
        
        echo -e "${GREEN}✓${NC} IAM role created"
        echo -e "${YELLOW}⏳${NC} Waiting 10 seconds for IAM role to propagate..."
        sleep 10
    else
        echo -e "${GREEN}✓${NC} IAM role already exists"
    fi
    
    echo ""
    echo "Step 3: Creating Lambda functions..."
    
    # Create START Lambda
    aws lambda create-function \
      --function-name gitlab-ec2-start \
      --runtime python3.11 \
      --role arn:aws:iam::${ACCOUNT_ID}:role/GitLabEC2SchedulerLambdaRole \
      --handler lambda_ec2_start.lambda_handler \
      --zip-file fileb://lambda_ec2_start.zip \
      --timeout 30 \
      --memory-size 128 \
      --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID}}" \
      --region ${AWS_REGION} \
      > /dev/null
    
    echo -e "${GREEN}✓${NC} Created gitlab-ec2-start function"
    
    # Create STOP Lambda
    aws lambda create-function \
      --function-name gitlab-ec2-stop \
      --runtime python3.11 \
      --role arn:aws:iam::${ACCOUNT_ID}:role/GitLabEC2SchedulerLambdaRole \
      --handler lambda_ec2_stop.lambda_handler \
      --zip-file fileb://lambda_ec2_stop.zip \
      --timeout 60 \
      --memory-size 128 \
      --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID},GRACEFUL_SHUTDOWN_SCRIPT=bash /opt/gitlab/scripts/graceful_shutdown.sh}" \
      --region ${AWS_REGION} \
      > /dev/null
    
    echo -e "${GREEN}✓${NC} Created gitlab-ec2-stop function"
    
    echo ""
    echo "Step 4: Granting EventBridge permissions..."
    
    # Grant permissions for START Lambda
    aws lambda add-permission \
      --function-name gitlab-ec2-start \
      --statement-id AllowEventBridgeInvoke \
      --action lambda:InvokeFunction \
      --principal events.amazonaws.com \
      --region ${AWS_REGION} \
      > /dev/null 2>&1 || true
    
    # Grant permissions for STOP Lambda
    aws lambda add-permission \
      --function-name gitlab-ec2-stop \
      --statement-id AllowEventBridgeInvoke \
      --action lambda:InvokeFunction \
      --principal events.amazonaws.com \
      --region ${AWS_REGION} \
      > /dev/null 2>&1 || true
    
    echo -e "${GREEN}✓${NC} EventBridge permissions granted"
    
else
    echo ""
    echo "Step 2: Updating Lambda functions..."
    
    # Update START Lambda
    aws lambda update-function-code \
      --function-name gitlab-ec2-start \
      --zip-file fileb://lambda_ec2_start.zip \
      --region ${AWS_REGION} \
      > /dev/null
    
    # Update environment variables
    aws lambda update-function-configuration \
      --function-name gitlab-ec2-start \
      --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID}}" \
      --region ${AWS_REGION} \
      > /dev/null
    
    echo -e "${GREEN}✓${NC} Updated gitlab-ec2-start function"
    
    # Update STOP Lambda
    aws lambda update-function-code \
      --function-name gitlab-ec2-stop \
      --zip-file fileb://lambda_ec2_stop.zip \
      --region ${AWS_REGION} \
      > /dev/null
    
    # Update environment variables
    aws lambda update-function-configuration \
      --function-name gitlab-ec2-stop \
      --environment Variables="{EC2_INSTANCE_ID=${EC2_INSTANCE_ID},GRACEFUL_SHUTDOWN_SCRIPT=bash /opt/gitlab/scripts/graceful_shutdown.sh}" \
      --region ${AWS_REGION} \
      > /dev/null
    
    echo -e "${GREEN}✓${NC} Updated gitlab-ec2-stop function"
fi

echo ""
echo "Step 5: Configuring EventBridge targets..."

# Add targets to EventBridge rules
aws events put-targets \
  --rule gitlab-ec2-start-weekday \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-start" \
  --region ${AWS_REGION} \
  > /dev/null 2>&1 || echo -e "${YELLOW}⚠${NC} Could not configure start rule target (rule may not exist yet)"

aws events put-targets \
  --rule gitlab-ec2-stop-weekday \
  --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-stop" \
  --region ${AWS_REGION} \
  > /dev/null 2>&1 || echo -e "${YELLOW}⚠${NC} Could not configure stop rule target (rule may not exist yet)"

echo -e "${GREEN}✓${NC} EventBridge targets configured"

# Clean up
rm -f lambda_ec2_start.zip lambda_ec2_stop.zip

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Lambda Function ARNs:"
echo "  START: arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-start"
echo "  STOP:  arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-stop"
echo ""
echo "Next steps:"
echo "  1. Add these ARNs to your backend/.env file:"
echo "     LAMBDA_START_ARN=arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-start"
echo "     LAMBDA_STOP_ARN=arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:gitlab-ec2-stop"
echo ""
echo "  2. Restart your backend to load the new configuration"
echo ""
echo "  3. Test the Lambda functions:"
echo "     aws lambda invoke --function-name gitlab-ec2-start --region ${AWS_REGION} /tmp/start-response.json"
echo "     aws lambda invoke --function-name gitlab-ec2-stop --region ${AWS_REGION} /tmp/stop-response.json"
echo ""
echo "  4. Verify EventBridge targets:"
echo "     aws events list-targets-by-rule --rule gitlab-ec2-start-weekday --region ${AWS_REGION}"
echo "     aws events list-targets-by-rule --rule gitlab-ec2-stop-weekday --region ${AWS_REGION}"
echo ""
