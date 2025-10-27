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
            "Sid": "LambdaInvoke",
            "Effect": "Allow",
            "Action": [
                "lambda:InvokeFunction"
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

# Deploy Lambda function
log_step "Step 6: Building and Deploying Lambda Function"

LAMBDA_FUNCTION_NAME="spp-trace-executor-$ENV_NAME"
LAMBDA_REPO_NAME="spp-lambda-trace"
LAMBDA_IMAGE_TAG="$ENV_NAME"
LAMBDA_ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$LAMBDA_REPO_NAME"

# Build Lambda Docker image
log_info "Building Lambda Docker image..."
if [ ! -d "code-runner/lambda" ]; then
    log_error "Lambda directory not found at code-runner/lambda"
    exit 1
fi

# Check if Valgrind is built
if [ ! -f "code-runner/SPP-Valgrind/vg-in-place" ]; then
    log_error "Valgrind not found at code-runner/SPP-Valgrind/vg-in-place"
    log_error "Please ensure SPP-Valgrind/ submodule is initialized and built"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "code-runner/lambda/Dockerfile.prod" ]; then
    log_error "Dockerfile.prod not found"
    exit 1
fi

log_info "Building Docker image from Dockerfile.prod..."
cd code-runner
docker build \
    --platform linux/amd64 \
    --provenance=false \
    --sbom=false \
    -t spp-lambda-trace:latest \
    -f lambda/Dockerfile.prod \
    . > /dev/null
cd ..
log_success "Lambda Docker image built"

# Create ECR repository if it doesn't exist
log_info "Setting up ECR repository for Lambda..."
if aws ecr describe-repositories --repository-names "$LAMBDA_REPO_NAME" --region "$AWS_REGION" &> /dev/null; then
    log_info "ECR repository '$LAMBDA_REPO_NAME' already exists"
else
    log_info "Creating ECR repository: $LAMBDA_REPO_NAME"
    aws ecr create-repository \
        --repository-name "$LAMBDA_REPO_NAME" \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256

    log_info "Setting lifecycle policy for ECR repository..."
    aws ecr put-lifecycle-policy \
        --repository-name "$LAMBDA_REPO_NAME" \
        --region "$AWS_REGION" \
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

# Login to ECR
log_info "Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "$LAMBDA_ECR_URI"
log_success "Logged into ECR"

# Tag and push image
log_info "Tagging and pushing Lambda image to ECR..."
docker tag spp-lambda-trace:latest "$LAMBDA_ECR_URI:$LAMBDA_IMAGE_TAG"
docker tag spp-lambda-trace:latest "$LAMBDA_ECR_URI:latest"
docker push "$LAMBDA_ECR_URI:$LAMBDA_IMAGE_TAG"
docker push "$LAMBDA_ECR_URI:latest"
log_success "Lambda image pushed to ECR"

# Create IAM role for Lambda if it doesn't exist
log_info "Setting up IAM role for Lambda..."
LAMBDA_ROLE_NAME="spp-lambda-execution-role-$ENV_NAME"
LAMBDA_ROLE_ARN=""

if aws iam get-role --role-name "$LAMBDA_ROLE_NAME" &> /dev/null; then
    log_info "IAM role '$LAMBDA_ROLE_NAME' already exists"
    LAMBDA_ROLE_ARN=$(aws iam get-role --role-name "$LAMBDA_ROLE_NAME" --query 'Role.Arn' --output text)
else
    log_info "Creating IAM role: $LAMBDA_ROLE_NAME"

    # Create trust policy
    cat > /tmp/lambda-trust-policy.json <<EOF
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
    LAMBDA_ROLE_ARN=$(aws iam create-role \
        --role-name "$LAMBDA_ROLE_NAME" \
        --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
        --query 'Role.Arn' \
        --output text)

    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name "$LAMBDA_ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    log_success "IAM role created"
    log_info "Waiting 10 seconds for IAM role to propagate..."
    sleep 10

    rm -f /tmp/lambda-trust-policy.json
fi

log_info "Lambda Role ARN: $LAMBDA_ROLE_ARN"

# Create or update Lambda function
log_info "Deploying Lambda function: $LAMBDA_FUNCTION_NAME"
if aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" &> /dev/null; then
    log_info "Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --image-uri "$LAMBDA_ECR_URI:$LAMBDA_IMAGE_TAG" \
        --region "$AWS_REGION" \
        --no-cli-pager > /dev/null

    log_info "Waiting for function update to complete..."
    aws lambda wait function-updated \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --region "$AWS_REGION"

    # Update configuration
    aws lambda update-function-configuration \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --timeout 120 \
        --memory-size 10240 \
        --region "$AWS_REGION" \
        --no-cli-pager > /dev/null

    log_success "Lambda function updated"
else
    log_info "Creating new Lambda function..."
    aws lambda create-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --package-type Image \
        --code ImageUri="$LAMBDA_ECR_URI:$LAMBDA_IMAGE_TAG" \
        --role "$LAMBDA_ROLE_ARN" \
        --timeout 120 \
        --memory-size 10240 \
        --architectures x86_64 \
        --region "$AWS_REGION" \
        --no-cli-pager > /dev/null

    log_success "Lambda function created"
fi

log_success "Lambda function deployed: $LAMBDA_FUNCTION_NAME"

# Configure S3 bucket lifecycle
log_step "Step 7: Configuring S3 Bucket Lifecycle Policy"

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
log_step "Step 8: Deploying Frontend Services"

log_info "Deploying frontend-legacy service..."
copilot svc deploy --name frontend-legacy --env "$ENV_NAME"
log_success "Frontend-legacy service deployed"

log_info "Deploying frontend service..."
copilot svc deploy --name frontend --env "$ENV_NAME"
log_success "Frontend service deployed"

# Verification
log_step "Step 9: Verification"

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
log_info "  3. Check Lambda code-runner logs: aws logs tail /aws/lambda/spp-trace-executor-$ENV_NAME --follow"
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
