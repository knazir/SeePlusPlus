#!/bin/bash
# Deploy See++ Lambda function to AWS

set -e

ENVIRONMENT="${1:-dev}"

if [[ ! "$ENVIRONMENT" =~ ^(dev|test|prod)$ ]]; then
    echo "ERROR: Invalid environment. Use: dev, test, or prod"
    echo "Usage: ./deploy.sh [dev|test|prod]"
    exit 1
fi

echo "================================"
echo "Deploying to AWS: $ENVIRONMENT"
echo "================================"
echo ""

# Check if built
if [ ! -d ".aws-sam" ]; then
    echo "ERROR: Function not built. Run ./build.sh first"
    exit 1
fi

# Confirm production deployment
if [ "$ENVIRONMENT" = "prod" ]; then
    echo "WARNING: You are about to deploy to PRODUCTION"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
    echo ""
fi

# Deploy with SAM
echo "Deploying Lambda function..."
sam deploy \
    --config-env "$ENVIRONMENT" \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
echo ""

# Get outputs
STACK_NAME="spp-lambda-$ENVIRONMENT"
echo "Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo "API Endpoint:"
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`TraceApiUrl`].OutputValue' \
    --output text

echo ""
