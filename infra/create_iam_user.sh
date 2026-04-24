#!/bin/bash
# Create IAM user with appropriate permissions for EC2 Dashboard

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}EC2 Dashboard IAM User Setup${NC}"
echo "=============================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Unable to get AWS account ID. Check your AWS credentials.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} AWS Account ID: $ACCOUNT_ID"
echo ""

# Prompt for setup type
echo "Choose setup type:"
echo "  1) Single user (deployment + runtime) - Recommended for development"
echo "  2) Separate users (deployment + runtime) - More secure"
echo "  3) Instance profile only (no IAM user) - Recommended for production"
echo ""
read -p "Enter choice [1-3]: " SETUP_TYPE

case $SETUP_TYPE in
    1)
        echo ""
        echo -e "${BLUE}Creating single IAM user with both policies...${NC}"
        
        # Prompt for username
        read -p "Enter username [ec2-dashboard-admin]: " USERNAME
        USERNAME=${USERNAME:-ec2-dashboard-admin}
        
        # Check if user exists
        USER_EXISTS=$(aws iam get-user --user-name $USERNAME 2>/dev/null && echo "yes" || echo "no")
        
        if [ "$USER_EXISTS" = "yes" ]; then
            echo -e "${YELLOW}⚠${NC} User $USERNAME already exists"
            read -p "Continue with existing user? (y/n): " CONTINUE
            if [ "$CONTINUE" != "y" ]; then
                echo "Setup cancelled."
                exit 0
            fi
        else
            # Create user
            echo "Creating IAM user: $USERNAME"
            aws iam create-user --user-name $USERNAME > /dev/null
            echo -e "${GREEN}✓${NC} User created"
        fi
        
        # Create policies
        echo ""
        echo "Creating IAM policies..."
        
        # Deployment policy
        DEPLOY_POLICY_EXISTS=$(aws iam get-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy 2>/dev/null && echo "yes" || echo "no")
        if [ "$DEPLOY_POLICY_EXISTS" = "no" ]; then
            aws iam create-policy \
              --policy-name EC2DashboardDeploymentPolicy \
              --policy-document file://iam_deployment_policy.json \
              > /dev/null
            echo -e "${GREEN}✓${NC} Deployment policy created"
        else
            echo -e "${YELLOW}⚠${NC} Deployment policy already exists"
        fi
        
        # Runtime policy
        RUNTIME_POLICY_EXISTS=$(aws iam get-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy 2>/dev/null && echo "yes" || echo "no")
        if [ "$RUNTIME_POLICY_EXISTS" = "no" ]; then
            aws iam create-policy \
              --policy-name EC2DashboardRuntimePolicy \
              --policy-document file://iam_runtime_policy.json \
              > /dev/null
            echo -e "${GREEN}✓${NC} Runtime policy created"
        else
            echo -e "${YELLOW}⚠${NC} Runtime policy already exists"
        fi
        
        # Attach policies
        echo ""
        echo "Attaching policies to user..."
        aws iam attach-user-policy \
          --user-name $USERNAME \
          --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy \
          2>/dev/null || echo -e "${YELLOW}⚠${NC} Deployment policy already attached"
        
        aws iam attach-user-policy \
          --user-name $USERNAME \
          --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy \
          2>/dev/null || echo -e "${YELLOW}⚠${NC} Runtime policy already attached"
        
        echo -e "${GREEN}✓${NC} Policies attached"
        
        # Create access keys
        echo ""
        read -p "Create new access keys? (y/n): " CREATE_KEYS
        if [ "$CREATE_KEYS" = "y" ]; then
            echo "Creating access keys..."
            KEYS=$(aws iam create-access-key --user-name $USERNAME --output json)
            ACCESS_KEY=$(echo $KEYS | jq -r '.AccessKey.AccessKeyId')
            SECRET_KEY=$(echo $KEYS | jq -r '.AccessKey.SecretAccessKey')
            
            echo ""
            echo -e "${GREEN}========================================${NC}"
            echo -e "${GREEN}Access Keys Created${NC}"
            echo -e "${GREEN}========================================${NC}"
            echo ""
            echo "Add these to your backend/.env file:"
            echo ""
            echo "AWS_ACCESS_KEY_ID=$ACCESS_KEY"
            echo "AWS_SECRET_ACCESS_KEY=$SECRET_KEY"
            echo ""
            echo -e "${YELLOW}⚠ IMPORTANT: Save these credentials now!${NC}"
            echo -e "${YELLOW}⚠ They will not be shown again.${NC}"
            echo ""
        fi
        
        echo -e "${GREEN}✓${NC} Setup complete!"
        echo ""
        echo "User: $USERNAME"
        echo "Policies: EC2DashboardDeploymentPolicy, EC2DashboardRuntimePolicy"
        echo ""
        echo "Next steps:"
        echo "  1. Add access keys to backend/.env"
        echo "  2. Run ./deploy_lambdas.sh to deploy Lambda functions"
        echo "  3. (Optional) Disable deployment policy after setup for security"
        ;;
        
    2)
        echo ""
        echo -e "${BLUE}Creating separate deployment and runtime users...${NC}"
        
        # Deployment user
        echo ""
        echo "Creating deployment user..."
        read -p "Enter deployment username [ec2-dashboard-deployer]: " DEPLOY_USER
        DEPLOY_USER=${DEPLOY_USER:-ec2-dashboard-deployer}
        
        DEPLOY_USER_EXISTS=$(aws iam get-user --user-name $DEPLOY_USER 2>/dev/null && echo "yes" || echo "no")
        if [ "$DEPLOY_USER_EXISTS" = "no" ]; then
            aws iam create-user --user-name $DEPLOY_USER > /dev/null
            echo -e "${GREEN}✓${NC} Deployment user created"
        else
            echo -e "${YELLOW}⚠${NC} Deployment user already exists"
        fi
        
        # Runtime user
        echo ""
        echo "Creating runtime user..."
        read -p "Enter runtime username [ec2-dashboard-runtime]: " RUNTIME_USER
        RUNTIME_USER=${RUNTIME_USER:-ec2-dashboard-runtime}
        
        RUNTIME_USER_EXISTS=$(aws iam get-user --user-name $RUNTIME_USER 2>/dev/null && echo "yes" || echo "no")
        if [ "$RUNTIME_USER_EXISTS" = "no" ]; then
            aws iam create-user --user-name $RUNTIME_USER > /dev/null
            echo -e "${GREEN}✓${NC} Runtime user created"
        else
            echo -e "${YELLOW}⚠${NC} Runtime user already exists"
        fi
        
        # Create and attach policies
        echo ""
        echo "Creating and attaching policies..."
        
        # Deployment policy
        DEPLOY_POLICY_EXISTS=$(aws iam get-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy 2>/dev/null && echo "yes" || echo "no")
        if [ "$DEPLOY_POLICY_EXISTS" = "no" ]; then
            aws iam create-policy \
              --policy-name EC2DashboardDeploymentPolicy \
              --policy-document file://iam_deployment_policy.json \
              > /dev/null
        fi
        
        aws iam attach-user-policy \
          --user-name $DEPLOY_USER \
          --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardDeploymentPolicy \
          2>/dev/null || true
        
        echo -e "${GREEN}✓${NC} Deployment policy attached to $DEPLOY_USER"
        
        # Runtime policy
        RUNTIME_POLICY_EXISTS=$(aws iam get-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy 2>/dev/null && echo "yes" || echo "no")
        if [ "$RUNTIME_POLICY_EXISTS" = "no" ]; then
            aws iam create-policy \
              --policy-name EC2DashboardRuntimePolicy \
              --policy-document file://iam_runtime_policy.json \
              > /dev/null
        fi
        
        aws iam attach-user-policy \
          --user-name $RUNTIME_USER \
          --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy \
          2>/dev/null || true
        
        echo -e "${GREEN}✓${NC} Runtime policy attached to $RUNTIME_USER"
        
        # Create access keys
        echo ""
        read -p "Create access keys for deployment user? (y/n): " CREATE_DEPLOY_KEYS
        if [ "$CREATE_DEPLOY_KEYS" = "y" ]; then
            DEPLOY_KEYS=$(aws iam create-access-key --user-name $DEPLOY_USER --output json)
            DEPLOY_ACCESS_KEY=$(echo $DEPLOY_KEYS | jq -r '.AccessKey.AccessKeyId')
            DEPLOY_SECRET_KEY=$(echo $DEPLOY_KEYS | jq -r '.AccessKey.SecretAccessKey')
            
            echo ""
            echo "Deployment user credentials:"
            echo "AWS_ACCESS_KEY_ID=$DEPLOY_ACCESS_KEY"
            echo "AWS_SECRET_ACCESS_KEY=$DEPLOY_SECRET_KEY"
            echo ""
        fi
        
        read -p "Create access keys for runtime user? (y/n): " CREATE_RUNTIME_KEYS
        if [ "$CREATE_RUNTIME_KEYS" = "y" ]; then
            RUNTIME_KEYS=$(aws iam create-access-key --user-name $RUNTIME_USER --output json)
            RUNTIME_ACCESS_KEY=$(echo $RUNTIME_KEYS | jq -r '.AccessKey.AccessKeyId')
            RUNTIME_SECRET_KEY=$(echo $RUNTIME_KEYS | jq -r '.AccessKey.SecretAccessKey')
            
            echo ""
            echo "Runtime user credentials (add to backend/.env):"
            echo "AWS_ACCESS_KEY_ID=$RUNTIME_ACCESS_KEY"
            echo "AWS_SECRET_ACCESS_KEY=$RUNTIME_SECRET_KEY"
            echo ""
        fi
        
        echo -e "${GREEN}✓${NC} Setup complete!"
        echo ""
        echo "Deployment user: $DEPLOY_USER (use for ./deploy_lambdas.sh)"
        echo "Runtime user: $RUNTIME_USER (use in backend/.env)"
        echo ""
        echo "Next steps:"
        echo "  1. Use deployment user credentials to run ./deploy_lambdas.sh"
        echo "  2. Add runtime user credentials to backend/.env"
        echo "  3. Disable deployment user access keys after deployment"
        ;;
        
    3)
        echo ""
        echo -e "${BLUE}Creating instance profile (no IAM user)...${NC}"
        
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
        echo "Creating IAM role..."
        ROLE_EXISTS=$(aws iam get-role --role-name EC2DashboardBackendRole 2>/dev/null && echo "yes" || echo "no")
        if [ "$ROLE_EXISTS" = "no" ]; then
            aws iam create-role \
              --role-name EC2DashboardBackendRole \
              --assume-role-policy-document file:///tmp/ec2-trust-policy.json \
              > /dev/null
            echo -e "${GREEN}✓${NC} Role created"
        else
            echo -e "${YELLOW}⚠${NC} Role already exists"
        fi
        
        # Create runtime policy
        echo "Creating runtime policy..."
        RUNTIME_POLICY_EXISTS=$(aws iam get-policy --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy 2>/dev/null && echo "yes" || echo "no")
        if [ "$RUNTIME_POLICY_EXISTS" = "no" ]; then
            aws iam create-policy \
              --policy-name EC2DashboardRuntimePolicy \
              --policy-document file://iam_runtime_policy.json \
              > /dev/null
            echo -e "${GREEN}✓${NC} Policy created"
        else
            echo -e "${YELLOW}⚠${NC} Policy already exists"
        fi
        
        # Attach policy to role
        echo "Attaching policy to role..."
        aws iam attach-role-policy \
          --role-name EC2DashboardBackendRole \
          --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/EC2DashboardRuntimePolicy \
          2>/dev/null || echo -e "${YELLOW}⚠${NC} Policy already attached"
        
        # Create instance profile
        echo "Creating instance profile..."
        PROFILE_EXISTS=$(aws iam get-instance-profile --instance-profile-name EC2DashboardBackendProfile 2>/dev/null && echo "yes" || echo "no")
        if [ "$PROFILE_EXISTS" = "no" ]; then
            aws iam create-instance-profile \
              --instance-profile-name EC2DashboardBackendProfile \
              > /dev/null
            echo -e "${GREEN}✓${NC} Instance profile created"
        else
            echo -e "${YELLOW}⚠${NC} Instance profile already exists"
        fi
        
        # Add role to instance profile
        aws iam add-role-to-instance-profile \
          --instance-profile-name EC2DashboardBackendProfile \
          --role-name EC2DashboardBackendRole \
          2>/dev/null || echo -e "${YELLOW}⚠${NC} Role already in instance profile"
        
        echo -e "${GREEN}✓${NC} Setup complete!"
        echo ""
        echo "Instance profile: EC2DashboardBackendProfile"
        echo "IAM role: EC2DashboardBackendRole"
        echo ""
        echo "Next steps:"
        echo "  1. Attach instance profile to your EC2 instance:"
        echo "     aws ec2 associate-iam-instance-profile \\"
        echo "       --instance-id i-YOUR_INSTANCE_ID \\"
        echo "       --iam-instance-profile Name=EC2DashboardBackendProfile"
        echo ""
        echo "  2. Leave AWS credentials empty in backend/.env:"
        echo "     AWS_ACCESS_KEY_ID="
        echo "     AWS_SECRET_ACCESS_KEY="
        echo ""
        echo "  3. Backend will automatically use instance profile credentials"
        echo ""
        echo "Note: You still need an IAM user with deployment policy to run ./deploy_lambdas.sh"
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "For more details, see: infra/IAM_USER_SETUP.md"
