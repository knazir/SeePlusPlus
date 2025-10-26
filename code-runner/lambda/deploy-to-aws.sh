#!/bin/bash
# Complete AWS Lambda deployment script
# This script handles ECR, Lambda function creation, and configuration

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-us-west-2}"

if [[ ! "$ENVIRONMENT" =~ ^(dev|test|prod)$ ]]; then
    echo "ERROR: Invalid environment. Use: dev, test, or prod"
    echo "Usage: ./deploy-to-aws.sh [dev|test|prod] [region]"
    exit 1
fi

echo "========================================"
echo "Deploying Lambda to AWS"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "========================================"
echo ""

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $ACCOUNT_ID"
echo "AWS Region: $REGION"
echo ""

# Configuration
REPO_NAME="spp-lambda-trace"
IMAGE_TAG="$ENVIRONMENT"
FUNCTION_NAME="spp-trace-executor-$ENVIRONMENT"
ECR_URI="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"

# Step 1: Create ECR repository if it doesn't exist
echo "Step 1: Setting up ECR repository..."
if aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$REGION" &>/dev/null; then
    echo "✓ ECR repository already exists"
else
    echo "Creating ECR repository: $REPO_NAME"
    aws ecr create-repository \
        --repository-name "$REPO_NAME" \
        --region "$REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256
    echo "✓ ECR repository created"
fi
echo ""

# Step 2: Login to ECR
echo "Step 2: Logging into ECR..."
aws ecr get-login-password --region "$REGION" | \
    docker login --username AWS --password-stdin "$ECR_URI"
echo "✓ Logged into ECR"
echo ""

# Step 3: Tag and push Docker image
echo "Step 3: Pushing Docker image to ECR..."
if ! docker image inspect spp-lambda-trace:latest &>/dev/null; then
    echo "ERROR: Docker image not found. Run ./build-docker.sh first"
    exit 1
fi

docker tag spp-lambda-trace:latest "$ECR_URI:$IMAGE_TAG"
docker tag spp-lambda-trace:latest "$ECR_URI:latest"

echo "Pushing image (this may take a few minutes)..."
docker push "$ECR_URI:$IMAGE_TAG"
docker push "$ECR_URI:latest"
echo "✓ Image pushed to ECR"
echo ""

# Step 4: Create IAM role for Lambda if it doesn't exist
echo "Step 4: Setting up IAM role..."
ROLE_NAME="spp-lambda-execution-role-$ENVIRONMENT"
ROLE_ARN=""

if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
    echo "✓ IAM role already exists"
    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
else
    echo "Creating IAM role: $ROLE_NAME"

    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
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
    ROLE_ARN=$(aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --query 'Role.Arn' \
        --output text)

    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

    echo "✓ IAM role created"
    echo "Waiting 10 seconds for IAM role to propagate..."
    sleep 10
fi

echo "Role ARN: $ROLE_ARN"
echo ""

# Step 5: Create or update Lambda function
echo "Step 5: Deploying Lambda function..."

if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    echo "Updating existing Lambda function..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --image-uri "$ECR_URI:$IMAGE_TAG" \
        --region "$REGION" \
        --no-cli-pager

    # Wait for update to complete
    echo "Waiting for function update to complete..."
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION"

    # Update configuration
    aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --timeout 180 \
        --memory-size 3008 \
        --region "$REGION" \
        --no-cli-pager

    echo "✓ Lambda function updated"
else
    echo "Creating new Lambda function..."
    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --package-type Image \
        --code ImageUri="$ECR_URI:$IMAGE_TAG" \
        --role "$ROLE_ARN" \
        --timeout 180 \
        --memory-size 3008 \
        --architectures x86_64 \
        --region "$REGION" \
        --no-cli-pager

    echo "✓ Lambda function created"
fi
echo ""

# Step 6: Output configuration for backend
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Lambda Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo ""
echo "Backend Configuration:"
echo "----------------------"
echo "Add these to your backend .env file:"
echo ""
echo "EXEC_MODE=lambda"
echo "LAMBDA_FUNCTION_NAME=$FUNCTION_NAME"
echo "AWS_REGION=$REGION"
echo ""
echo "If running locally, also add your AWS credentials:"
echo "AWS_ACCESS_KEY_ID=your_access_key"
echo "AWS_SECRET_ACCESS_KEY=your_secret_key"
echo ""

# Cleanup
rm -f /tmp/trust-policy.json
