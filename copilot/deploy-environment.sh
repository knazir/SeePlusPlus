#!/bin/bash

# ============================================================================
# See++ Environment Deployment Script
# ============================================================================
#
# This script automates the deployment of a complete See++ environment
# (test or prod) including all manual configuration steps.
#
# Usage:
#   ./copilot/deploy-environment.sh <environment>
#
# Arguments:
#   environment: Either 'test' or 'prod'
#
# Example:
#   ./copilot/deploy-environment.sh test
#   ./copilot/deploy-environment.sh prod
#
# Prerequisites:
#   - AWS CLI configured with valid credentials
#   - AWS Copilot CLI installed
#   - Docker installed and running
#   - Appropriate AWS permissions
#
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# Check if script is run from project root
check_project_root() {
    if [ ! -f "copilot/.workspace" ]; then
        log_error "This script must be run from the project root directory"
        log_error "Current directory: $(pwd)"
        exit 1
    fi
}

# Validate arguments
if [ $# -ne 1 ]; then
    log_error "Usage: $0 <environment>"
    log_error "Environment must be either 'test' or 'prod'"
    exit 1
fi

ENV_NAME=$1

if [ "$ENV_NAME" != "test" ] && [ "$ENV_NAME" != "prod" ]; then
    log_error "Environment must be either 'test' or 'prod', got: $ENV_NAME"
    exit 1
fi

log_info "Starting deployment for environment: $ENV_NAME"

# Check prerequisites
log_step "Step 0: Checking Prerequisites"

check_project_root

if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed"
    exit 1
fi
log_success "AWS CLI found"

if ! command -v copilot &> /dev/null; then
    log_error "AWS Copilot CLI is not installed"
    exit 1
fi
log_success "Copilot CLI found"

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi
log_success "Docker found"

if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials are not configured or invalid"
    exit 1
fi
log_success "AWS credentials validated"

# Get AWS account info
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-west-2")
log_info "AWS Account ID: $AWS_ACCOUNT_ID"
log_info "AWS Region: $AWS_REGION"

# Check if environment already exists
log_step "Step 1: Checking if Environment Already Exists"

if copilot env show --name "$ENV_NAME" &> /dev/null; then
    log_warning "Environment '$ENV_NAME' already exists!"
    read -p "Do you want to continue and update the existing environment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
    ENVIRONMENT_EXISTS=true
else
    log_info "Environment '$ENV_NAME' does not exist, will create new"
    ENVIRONMENT_EXISTS=false
fi

# Create/Deploy environment
if [ "$ENVIRONMENT_EXISTS" = false ]; then
    log_step "Step 2: Creating New Environment"

    log_info "Initializing environment '$ENV_NAME'..."
    copilot env init --name "$ENV_NAME" --profile default --default-config

    log_info "Deploying environment infrastructure..."
    copilot env deploy --name "$ENV_NAME"

    log_success "Environment '$ENV_NAME' created successfully"
else
    log_step "Step 2: Skipping Environment Creation (Already Exists)"
fi

# Deploy backend service
log_step "Step 3: Deploying Backend Service"

log_info "Deploying backend service to '$ENV_NAME'..."
copilot svc deploy --name backend --env "$ENV_NAME"
log_success "Backend service deployed"

# Configure IAM roles
log_step "Step 4: Configuring IAM Roles"

log_info "Finding IAM roles for backend service..."
EXECUTION_ROLE=$(aws iam list-roles --query "Roles[?contains(RoleName, 'spp-${ENV_NAME}-backend-ExecutionRole')].RoleName" --output text | head -1)
TASK_ROLE=$(aws iam list-roles --query "Roles[?contains(RoleName, 'spp-${ENV_NAME}-backend-TaskRole')].RoleName" --output text | head -1)

if [ -z "$EXECUTION_ROLE" ] || [ -z "$TASK_ROLE" ]; then
    log_error "Could not find backend IAM roles"
    log_error "Execution Role: $EXECUTION_ROLE"
    log_error "Task Role: $TASK_ROLE"
    exit 1
fi

log_info "Execution Role: $EXECUTION_ROLE"
log_info "Task Role: $TASK_ROLE"

# Create IAM policy document
log_info "Creating IAM policy for backend permissions..."
cat > /tmp/spp-backend-policy.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "S3Access",
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject"
            ],
            "Resource": "arn:aws:s3:::spp-${ENV_NAME}-*/*"
        },
        {
            "Sid": "ECSRunTask",
            "Effect": "Allow",
            "Action": [
                "ecs:RunTask",
                "ecs:DescribeTasks",
                "iam:PassRole"
            ],
            "Resource": "*"
        },
        {
            "Sid": "ECRImagePull",
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CloudWatchLogs",
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:CreateLogGroup"
            ],
            "Resource": "*"
        },
        {
            "Sid": "SSMSecretsAccess",
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter",
                "ssm:GetParameters"
            ],
            "Resource": "arn:aws:ssm:*:*:parameter/copilot/*"
        },
        {
            "Sid": "SecretsManagerAccess",
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Apply policy to execution role
log_info "Applying policy to execution role..."
if aws iam get-role-policy --role-name "$EXECUTION_ROLE" --policy-name "SPPBackendPermissions" &> /dev/null; then
    log_warning "Policy 'SPPBackendPermissions' already exists on execution role, updating..."
fi
aws iam put-role-policy \
    --role-name "$EXECUTION_ROLE" \
    --policy-name "SPPBackendPermissions" \
    --policy-document file:///tmp/spp-backend-policy.json
log_success "Policy applied to execution role"

# Apply policy to task role
log_info "Applying policy to task role..."
if aws iam get-role-policy --role-name "$TASK_ROLE" --policy-name "SPPBackendPermissions" &> /dev/null; then
    log_warning "Policy 'SPPBackendPermissions' already exists on task role, updating..."
fi
aws iam put-role-policy \
    --role-name "$TASK_ROLE" \
    --policy-name "SPPBackendPermissions" \
    --policy-document file:///tmp/spp-backend-policy.json
log_success "Policy applied to task role"

# Create DenyIAM policy
log_info "Creating DenyIAM policy for task role..."
cat > /tmp/spp-deny-iam.json <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "iam:CreateUser",
                "iam:DeleteUser",
                "iam:CreatePolicy"
            ],
            "Resource": "*",
            "Effect": "Deny"
        }
    ]
}
EOF

if aws iam get-role-policy --role-name "$TASK_ROLE" --policy-name "DenyIAMActions" &> /dev/null; then
    log_warning "Policy 'DenyIAMActions' already exists on task role, updating..."
fi
aws iam put-role-policy \
    --role-name "$TASK_ROLE" \
    --policy-name "DenyIAMActions" \
    --policy-document file:///tmp/spp-deny-iam.json
log_success "DenyIAM policy applied to task role"

# Cleanup temp files
rm -f /tmp/spp-backend-policy.json /tmp/spp-deny-iam.json

# Configure load balancer
log_step "Step 5: Configuring Load Balancer Timeout"

log_info "Finding load balancer for environment '$ENV_NAME'..."
# Copilot truncates environment names in LB names (test -> te, prod -> pr)
ENV_PREFIX=$(echo "${ENV_NAME}" | cut -c1-2)
LB_ARN=$(aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?contains(LoadBalancerName, 'spp-${ENV_PREFIX}')].LoadBalancerArn" \
    --output text | head -1)

if [ -z "$LB_ARN" ]; then
    log_error "Could not find load balancer for environment '$ENV_NAME'"
    exit 1
fi

log_info "Load Balancer ARN: $LB_ARN"
log_info "Setting idle timeout to 300 seconds..."
aws elbv2 modify-load-balancer-attributes \
    --load-balancer-arn "$LB_ARN" \
    --attributes Key=idle_timeout.timeout_seconds,Value=300 \
    --no-cli-pager > /dev/null
log_success "Load balancer timeout configured"

# Setup ECR repository
log_step "Step 6: Setting Up ECR Repository"

if aws ecr describe-repositories --repository-names spp-code-runner --region "$AWS_REGION" &> /dev/null; then
    log_warning "ECR repository 'spp-code-runner' already exists"
else
    log_info "Creating ECR repository 'spp-code-runner'..."
    aws ecr create-repository \
        --repository-name spp-code-runner \
        --region "$AWS_REGION"

    log_info "Setting lifecycle policy for ECR repository..."
    aws ecr put-lifecycle-policy \
        --repository-name spp-code-runner \
        --lifecycle-policy-text '{
            "rules": [
                {
                    "rulePriority": 1,
                    "selection": {
                        "tagStatus": "untagged",
                        "countType": "sinceImagePushed",
                        "countUnit": "days",
                        "countNumber": 7
                    },
                    "action": {
                        "type": "expire"
                    }
                }
            ]
        }'
    log_success "ECR repository created and configured"
fi

# # Build and push code runner
log_step "Step 7: Building and Pushing Code Runner Image"

# log_info "This may take 10-15 minutes..."
export AWS_REGION=$AWS_REGION
export AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID
export ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/spp-code-runner"

if [ ! -f "./localdev.sh" ]; then
    log_error "localdev.sh script not found"
    exit 1
fi

./localdev.sh deploy "$ENV_NAME" code-runner
log_success "Code runner image built and pushed"

# Register task definition
log_step "Step 8: Registering Code Runner Task Definition"

EXEC_ROLE_ARN=$(aws iam get-role --role-name "$EXECUTION_ROLE" --query 'Role.Arn' --output text)
TASK_ROLE_ARN=$(aws iam get-role --role-name "$TASK_ROLE" --query 'Role.Arn' --output text)

log_info "Creating task definition..."
cat > /tmp/task-def-${ENV_NAME}.json <<EOF
{
    "family": "spp-code-runner-task-${ENV_NAME}",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048",
    "runtimePlatform": {
        "operatingSystemFamily": "LINUX",
        "cpuArchitecture": "X86_64"
    },
    "executionRoleArn": "${EXEC_ROLE_ARN}",
    "taskRoleArn": "${TASK_ROLE_ARN}",
    "containerDefinitions": [
        {
            "name": "spp-code-runner",
            "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/spp-code-runner:${ENV_NAME}",
            "essential": true,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/spp-code-runner-${ENV_NAME}",
                    "awslogs-region": "${AWS_REGION}",
                    "awslogs-stream-prefix": "ecs",
                    "awslogs-create-group": "true"
                }
            },
            "environment": []
        }
    ]
}
EOF

log_info "Registering task definition..."
TASK_DEF_OUTPUT=$(aws ecs register-task-definition --cli-input-json file:///tmp/task-def-${ENV_NAME}.json)
TASK_DEF_ARN=$(echo "$TASK_DEF_OUTPUT" | grep -o '"taskDefinitionArn": "[^"]*"' | cut -d'"' -f4)

if [ -z "$TASK_DEF_ARN" ]; then
    log_error "Failed to register task definition"
    exit 1
fi

log_success "Task definition registered: $TASK_DEF_ARN"
rm -f /tmp/task-def-${ENV_NAME}.json

# Gather infrastructure values for secrets
log_step "Step 9: Gathering Infrastructure Values"

log_info "Getting cluster ARN..."
CLUSTER_ARN=$(aws ecs list-clusters --query "clusterArns[?contains(@, 'spp-${ENV_NAME}')]" --output text | head -1)

log_info "Getting security group..."
SECURITY_GROUP=$(aws ec2 describe-security-groups \
    --filters "Name=tag:copilot-environment,Values=${ENV_NAME}" \
    --query "SecurityGroups[?contains(GroupName, 'EnvironmentSecurityGroup')].GroupId" \
    --output text | head -1)

log_info "Getting public subnets..."
SUBNETS=$(aws ec2 describe-subnets \
    --filters "Name=tag:copilot-environment,Values=${ENV_NAME}" \
              "Name=tag:aws:cloudformation:logical-id,Values=PublicSubnet*" \
    --query 'Subnets[].SubnetId' \
    --output text | tr '\t' ',')

ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/spp-code-runner"

log_info "Infrastructure values gathered:"
log_info "  CLUSTER_ARN: $CLUSTER_ARN"
log_info "  SECURITY_GROUP: $SECURITY_GROUP"
log_info "  SUBNETS: $SUBNETS"
log_info "  ECR_REPO: $ECR_REPO"
log_info "  TASK_DEF_ARN: $TASK_DEF_ARN"

# Validate values
if [ -z "$CLUSTER_ARN" ] || [ -z "$SECURITY_GROUP" ] || [ -z "$SUBNETS" ]; then
    log_error "Failed to gather all required infrastructure values"
    exit 1
fi

# Configure secrets
log_step "Step 10: Configuring Secrets in Parameter Store"

log_info "Setting CLUSTER_ARN secret..."
aws ssm put-parameter \
    --name "/copilot/spp/${ENV_NAME}/secrets/CLUSTER_ARN" \
    --value "${CLUSTER_ARN}" \
    --type "SecureString" \
    --overwrite

log_info "Setting ECR_REPO secret..."
aws ssm put-parameter \
    --name "/copilot/spp/${ENV_NAME}/secrets/ECR_REPO" \
    --value "${ECR_REPO}" \
    --type "SecureString" \
    --overwrite

log_info "Setting SECURITY_GROUP secret..."
aws ssm put-parameter \
    --name "/copilot/spp/${ENV_NAME}/secrets/SECURITY_GROUP" \
    --value "${SECURITY_GROUP}" \
    --type "SecureString" \
    --overwrite

log_info "Setting SUBNETS secret..."
aws ssm put-parameter \
    --name "/copilot/spp/${ENV_NAME}/secrets/SUBNETS" \
    --value "${SUBNETS}" \
    --type "SecureString" \
    --overwrite

log_info "Setting TASK_DEF_ARN secret..."
aws ssm put-parameter \
    --name "/copilot/spp/${ENV_NAME}/secrets/TASK_DEF_ARN" \
    --value "${TASK_DEF_ARN}" \
    --type "SecureString" \
    --overwrite

log_success "All secrets configured"

# Configure S3 bucket lifecycle
log_step "Step 11: Configuring S3 Bucket Lifecycle Policy"

log_info "Finding trace bucket..."
BUCKET_NAME=$(aws s3 ls | grep "spp-${ENV_NAME}.*trace" | awk '{print $3}' | head -1)

if [ -z "$BUCKET_NAME" ]; then
    log_error "Could not find trace bucket for environment '$ENV_NAME'"
    exit 1
fi

log_info "Bucket name: $BUCKET_NAME"
log_info "Setting lifecycle policy (1 day retention)..."
aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --lifecycle-configuration '{
        "Rules": [
            {
                "ID": "DeleteOldTraces",
                "Status": "Enabled",
                "Filter": {"Prefix": ""},
                "Expiration": {"Days": 1}
            }
        ]
    }'
log_success "S3 bucket lifecycle policy configured"

# Deploy frontend services
log_step "Step 12: Deploying Frontend Services"

log_info "Deploying frontend-legacy service..."
copilot svc deploy --name frontend-legacy --env "$ENV_NAME"
log_success "Frontend-legacy service deployed"

log_info "Deploying frontend service..."
copilot svc deploy --name frontend --env "$ENV_NAME"
log_success "Frontend service deployed"

# Verification
log_step "Step 13: Verification"

log_info "Environment Status:"
copilot env show --name "$ENV_NAME"

echo ""
log_info "Service URLs:"
copilot svc show --name frontend-legacy --env "$ENV_NAME" | grep -A 5 "Routes"
copilot svc show --name backend --env "$ENV_NAME" | grep -A 5 "Routes"

# Summary
log_step "Deployment Complete!"

echo ""
log_success "Environment '$ENV_NAME' has been successfully deployed!"
echo ""
log_info "Next steps:"
log_info "  1. Test the frontend by visiting the URL above"
log_info "  2. Monitor logs with: copilot svc logs --name backend --env $ENV_NAME --follow"
log_info "  3. Check code runner logs: aws logs tail /ecs/spp-code-runner-$ENV_NAME --follow"
echo ""
log_info "To test code execution, visit the frontend URL and try running this:"
echo ""
echo "  #include <iostream>"
echo "  int main() {"
echo "      std::cout << \"Hello from $ENV_NAME environment!\" << std::endl;"
echo "      return 0;"
echo "  }"
echo ""
log_success "Deployment script completed successfully!"
