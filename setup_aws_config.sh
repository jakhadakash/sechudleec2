#!/bin/bash
# AWS Configuration Setup Helper
# This script helps you gather the required AWS information for the dashboard

set -e

echo "=========================================="
echo "  EC2 Scheduler Dashboard"
echo "  AWS Configuration Setup"
echo "=========================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "⚠ WARNING: AWS CLI is not installed"
    echo "  Install it with: pip install awscli"
    echo "  Or visit: https://aws.amazon.com/cli/"
    echo ""
fi

echo "This script will help you gather AWS configuration information."
echo "You'll need AWS CLI configured or access to AWS Console."
echo ""

# Function to prompt for input
prompt_input() {
    local var_name=$1
    local description=$2
    local current_value=$3
    
    echo "---"
    echo "$description"
    if [ -n "$current_value" ] && [ "$current_value" != "i-0xxxxxxxxxxxxxxx" ] && [[ "$current_value" != *"ACCOUNT"* ]]; then
        echo "Current value: $current_value"
        read -p "Keep this value? (y/n): " keep
        if [ "$keep" = "y" ] || [ "$keep" = "Y" ]; then
            echo "$current_value"
            return
        fi
    fi
    
    read -p "Enter $var_name: " value
    echo "$value"
}

# Read current .env if it exists
ENV_FILE="ec2-dashboard/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
    ENV_FILE="ec2-dashboard/.env"
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "✗ ERROR: .env file not found!"
    echo "  Please create $ENV_FILE from .env.example"
    exit 1
fi

echo "Reading current configuration from: $ENV_FILE"
echo ""

# Source the .env file
set -a
source "$ENV_FILE"
set +a

echo "=========================================="
echo "  Step 1: AWS Credentials"
echo "=========================================="
echo ""
echo "You have two options for AWS credentials:"
echo "  1. Use IAM User Access Keys (for development/testing)"
echo "  2. Use IAM Instance Profile (recommended for production)"
echo ""
echo "If running on EC2, you can leave credentials empty and use instance profile."
echo ""

read -p "Do you want to set AWS access keys? (y/n): " set_keys

if [ "$set_keys" = "y" ] || [ "$set_keys" = "Y" ]; then
    NEW_ACCESS_KEY=$(prompt_input "AWS_ACCESS_KEY_ID" "Your AWS Access Key ID" "$AWS_ACCESS_KEY_ID")
    NEW_SECRET_KEY=$(prompt_input "AWS_SECRET_ACCESS_KEY" "Your AWS Secret Access Key" "$AWS_SECRET_ACCESS_KEY")
else
    echo "Skipping credentials (will use default credential chain)"
    NEW_ACCESS_KEY=""
    NEW_SECRET_KEY=""
fi

echo ""
echo "=========================================="
echo "  Step 2: AWS Region"
echo "=========================================="
echo ""
NEW_REGION=$(prompt_input "AWS_REGION" "Your AWS region (e.g., ap-south-1, us-east-1)" "$AWS_REGION")

echo ""
echo "=========================================="
echo "  Step 3: EC2 Instance ID"
echo "=========================================="
echo ""
echo "Finding your EC2 instances..."

if command -v aws &> /dev/null; then
    echo ""
    echo "Available EC2 instances in $NEW_REGION:"
    aws ec2 describe-instances \
        --region "$NEW_REGION" \
        --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name,Tags[?Key==`Name`].Value|[0]]' \
        --output table 2>/dev/null || echo "  (Unable to list instances - check AWS CLI configuration)"
    echo ""
fi

NEW_INSTANCE_ID=$(prompt_input "EC2_INSTANCE_ID" "Your EC2 Instance ID (e.g., i-0123456789abcdef0)" "$EC2_INSTANCE_ID")

echo ""
echo "=========================================="
echo "  Step 4: GitLab Host"
echo "=========================================="
echo ""
NEW_GITLAB_HOST=$(prompt_input "GITLAB_HOST" "Your GitLab hostname (e.g., gitlab.example.com)" "$GITLAB_HOST")

echo ""
echo "=========================================="
echo "  Step 5: SSH Key Path"
echo "=========================================="
echo ""
NEW_SSH_KEY=$(prompt_input "SSH_KEY_PATH" "Path to SSH private key for GitLab host" "$SSH_KEY_PATH")

echo ""
echo "=========================================="
echo "  Step 6: Dashboard API Key"
echo "=========================================="
echo ""
echo "This is the API key used to authenticate dashboard requests."
echo "Current key: ${DASHBOARD_API_KEY:0:20}..."
echo ""
read -p "Generate a new random API key? (y/n): " gen_key

if [ "$gen_key" = "y" ] || [ "$gen_key" = "Y" ]; then
    NEW_API_KEY=$(openssl rand -hex 32)
    echo "Generated new API key: ${NEW_API_KEY:0:20}..."
else
    NEW_API_KEY="$DASHBOARD_API_KEY"
fi

echo ""
echo "=========================================="
echo "  Step 7: SSL Domains"
echo "=========================================="
echo ""
NEW_SSL_DOMAINS=$(prompt_input "SSL_DOMAINS" "Comma-separated list of domains to monitor (e.g., gitlab.example.com,www.example.com)" "$SSL_DOMAINS")

echo ""
echo "=========================================="
echo "  Step 8: EventBridge Rules (Optional)"
echo "=========================================="
echo ""
echo "EventBridge rules for automated scheduling."
echo "You can create these later using infra/eventbridge_rules.json"
echo ""
NEW_RULE_START=$(prompt_input "EVENTBRIDGE_RULE_START" "EventBridge rule name for start schedule" "$EVENTBRIDGE_RULE_START")
NEW_RULE_STOP=$(prompt_input "EVENTBRIDGE_RULE_STOP" "EventBridge rule name for stop schedule" "$EVENTBRIDGE_RULE_STOP")

echo ""
echo "=========================================="
echo "  Step 9: SNS Topic (Optional)"
echo "=========================================="
echo ""
echo "SNS topic for alert notifications."
echo "Leave empty to disable alerts."
echo ""

if command -v aws &> /dev/null; then
    echo "Available SNS topics in $NEW_REGION:"
    aws sns list-topics --region "$NEW_REGION" --query 'Topics[*].TopicArn' --output table 2>/dev/null || echo "  (Unable to list topics)"
    echo ""
fi

read -p "Do you want to configure SNS alerts? (y/n): " config_sns

if [ "$config_sns" = "y" ] || [ "$config_sns" = "Y" ]; then
    NEW_SNS_TOPIC=$(prompt_input "SNS_TOPIC_ARN" "SNS Topic ARN" "$SNS_TOPIC_ARN")
else
    NEW_SNS_TOPIC=""
fi

echo ""
echo "=========================================="
echo "  Configuration Summary"
echo "=========================================="
echo ""
echo "AWS_REGION: $NEW_REGION"
echo "AWS_ACCESS_KEY_ID: ${NEW_ACCESS_KEY:+Set (${#NEW_ACCESS_KEY} chars)}"
echo "AWS_SECRET_ACCESS_KEY: ${NEW_SECRET_KEY:+Set (${#NEW_SECRET_KEY} chars)}"
echo "EC2_INSTANCE_ID: $NEW_INSTANCE_ID"
echo "GITLAB_HOST: $NEW_GITLAB_HOST"
echo "SSH_KEY_PATH: $NEW_SSH_KEY"
echo "DASHBOARD_API_KEY: ${NEW_API_KEY:0:20}..."
echo "SSL_DOMAINS: $NEW_SSL_DOMAINS"
echo "EVENTBRIDGE_RULE_START: $NEW_RULE_START"
echo "EVENTBRIDGE_RULE_STOP: $NEW_RULE_STOP"
echo "SNS_TOPIC_ARN: ${NEW_SNS_TOPIC:-Not configured}"
echo ""

read -p "Save this configuration to $ENV_FILE? (y/n): " save_config

if [ "$save_config" = "y" ] || [ "$save_config" = "Y" ]; then
    # Backup existing .env
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Write new .env
    cat > "$ENV_FILE" << EOF
AWS_REGION=$NEW_REGION
AWS_ACCESS_KEY_ID=$NEW_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=$NEW_SECRET_KEY
EC2_INSTANCE_ID=$NEW_INSTANCE_ID
GITLAB_HOST=$NEW_GITLAB_HOST
SSH_KEY_PATH=$NEW_SSH_KEY
DASHBOARD_API_KEY=$NEW_API_KEY
SNS_TOPIC_ARN=$NEW_SNS_TOPIC
EVENTBRIDGE_RULE_STOP=$NEW_RULE_STOP
EVENTBRIDGE_RULE_START=$NEW_RULE_START
EVENTBRIDGE_RULE_WEEKEND_STOP=${EVENTBRIDGE_RULE_WEEKEND_STOP}
EVENTBRIDGE_RULE_WEEKEND_START=${EVENTBRIDGE_RULE_WEEKEND_START}
SSL_DOMAINS=$NEW_SSL_DOMAINS
EOF
    
    echo "✓ Configuration saved to $ENV_FILE"
    echo "  (Backup saved to ${ENV_FILE}.backup.*)"
    echo ""
    echo "Next steps:"
    echo "  1. Test AWS connectivity: python backend/test_aws_connection.py"
    echo "  2. Create EventBridge rules (see infra/eventbridge_rules.json)"
    echo "  3. Create SNS topic for alerts (optional)"
    echo "  4. Start the backend: uvicorn backend.main:app --reload"
else
    echo "Configuration not saved."
fi

echo ""
echo "=========================================="
echo "  Setup Complete"
echo "=========================================="
