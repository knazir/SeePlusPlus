# See++ Lambda Deployment Guide

Complete guide for deploying and testing the Lambda-based trace execution system.

## Prerequisites

- ✅ AWS CLI configured with appropriate credentials
- ✅ Docker installed and running
- ✅ Valgrind 3.27.0 built in `../valgrind/`
- ✅ AWS Account with permissions for Lambda, ECR, IAM

## Step 1: Build the Lambda Docker Image

**Time Required**: ~20-30 minutes (first build), ~2 minutes (subsequent builds)

```bash
cd code-runner-new/lambda
./build-docker.sh
```

This will:
1. Build Lambda Python 3.12 base image
2. Install build dependencies (gcc, make, etc.)
3. Compile Valgrind 3.27.0 from source
4. Copy trace conversion scripts
5. Package handler code

**Expected Output**:
```
================================
Building Lambda Docker Image
================================

✓ Valgrind found

Building Docker image...
[... Docker build output ...]

================================
Build Complete!
================================

Image: spp-lambda-trace:latest
```

## Step 2: Deploy to AWS

**Time Required**: ~5-10 minutes

```bash
./deploy-to-aws.sh dev
```

This automated script will:

1. **Create ECR Repository** (if doesn't exist)
   - Name: `spp-lambda-trace`
   - Encryption: AES256
   - Scan on push: Enabled

2. **Push Docker Image** (~2-5 minutes)
   - Tags: `dev`, `latest`
   - Size: ~2.5GB (Valgrind + dependencies)

3. **Create IAM Role** (if doesn't exist)
   - Name: `spp-lambda-execution-role-dev`
   - Permissions: Lambda execution, CloudWatch Logs

4. **Deploy Lambda Function**
   - Name: `spp-trace-executor-dev`
   - Memory: 3008 MB (~3GB)
   - Timeout: 180 seconds (3 minutes)
   - Architecture: x86_64

5. **Test Deployment**
   - Runs simple test: `int main() { int x = 42; return 0; }`
   - Verifies trace generation

**Expected Output**:
```
========================================
Deployment Complete!
========================================

Lambda Function: spp-trace-executor-dev
Region: us-west-2

Backend Configuration:
----------------------
Add these to your backend .env file:

EXEC_MODE=lambda
LAMBDA_FUNCTION_NAME=spp-trace-executor-dev
AWS_REGION=us-west-2
```

## Step 3: Configure Backend

### Option A: Using Environment Variables

```bash
cd backend

# Create .env file with Lambda configuration
cat > .env <<EOF
EXEC_MODE=lambda
LAMBDA_FUNCTION_NAME=spp-trace-executor-dev
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
PORT=3000
NODE_ENV=development
ALLOWED_ORIGIN_REGEX=.*
USER_CODE_FILE_PREFIX=main
EOF
```

### Option B: Copy Example File

```bash
cd backend
cp .env.lambda.example .env

# Edit .env and add your AWS credentials
```

**Required Variables**:
- `EXEC_MODE=lambda` - Use Lambda runner
- `LAMBDA_FUNCTION_NAME` - Lambda function name
- `AWS_REGION` - AWS region (e.g., us-west-2)
- `AWS_ACCESS_KEY_ID` - Your AWS access key (for local testing)
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key (for local testing)

## Step 4: Install Backend Dependencies

```bash
cd backend
npm install
```

If you haven't already, also install the AWS SDK v3 for Lambda:

```bash
npm install @aws-sdk/client-lambda
```

## Step 5: Start Backend Locally

```bash
cd backend
npm run dev
```

**Expected Output**:
```
Using LambdaRunner
See++ backend listening on port 3000
```

The "Using LambdaRunner" message confirms Lambda mode is active.

## Step 6: Test End-to-End

### Option A: Using curl

```bash
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "code": "int main() { int x = 42; int y = 10; int z = x + y; return z; }"
  }' | jq '.trace.trace[0].stack_to_render[0].encoded_locals'
```

**Expected Response**:
```json
{
  "x": ["C_DATA", "0x1FFF000A9C", "int", "42"],
  "y": ["C_DATA", "0x1FFF000A98", "int", "10"],
  "z": ["C_DATA", "0x1FFF000A94", "int", "<UNINITIALIZED>"]
}
```

### Option B: Using Frontend

1. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open http://localhost:5173 in your browser

3. Enter C++ code and click "Visualize"

4. Backend logs should show:
   ```
   Using LambdaRunner
   Invoking Lambda function: spp-trace-executor-dev
   Lambda execution completed in 1234ms
   ```

## Performance Expectations

### Cold Start (First Request)
- **Lambda initialization**: 3-5 seconds
- **Valgrind execution**: 1-3 seconds
- **Total**: 4-8 seconds

### Warm Start (Subsequent Requests)
- **Lambda execution**: <1 second
- **Valgrind execution**: 1-3 seconds
- **Total**: 1-4 seconds

### With Caching (Repeated Code)
- **S3 cache hit**: 50-100ms
- **Total**: <1 second

## Monitoring

### View Lambda Logs

```bash
# Tail live logs
aws logs tail /aws/lambda/spp-trace-executor-dev --follow

# View recent logs
aws logs tail /aws/lambda/spp-trace-executor-dev --since 10m
```

### CloudWatch Metrics

Navigate to AWS Console → Lambda → spp-trace-executor-dev → Monitoring

Key metrics:
- **Invocations**: Number of executions
- **Duration**: Execution time (should be 1-5s)
- **Errors**: Failed invocations
- **Throttles**: Rate limit hits

### Backend Logs

Backend will log:
```
Using LambdaRunner
Invoking Lambda function: spp-trace-executor-dev
Unique ID: abc123def456...
Lambda execution completed in 1234ms
```

## Troubleshooting

### Lambda Cold Starts Too Slow (>10s)

**Solution**: Enable provisioned concurrency

```bash
aws lambda put-provisioned-concurrency-config \
  --function-name spp-trace-executor-dev \
  --provisioned-concurrent-executions 1
```

Cost: ~$6/month for 1 instance, but ensures <1s response time.

### Backend Can't Connect to Lambda

**Symptoms**:
```
Error: AccessDeniedException: User is not authorized to perform: lambda:InvokeFunction
```

**Solution**: Add Lambda invoke permissions to IAM user/role:

```bash
aws iam attach-user-policy \
  --user-name your-username \
  --policy-arn arn:aws:iam::aws:policy/AWSLambdaExecute
```

Or create custom policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:us-west-2:*:function:spp-trace-executor-*"
    }
  ]
}
```

### Lambda Timeout Errors

**Symptoms**:
```
Task timed out after 180.00 seconds
```

**Solution**: Increase timeout

```bash
aws lambda update-function-configuration \
  --function-name spp-trace-executor-dev \
  --timeout 300
```

### Empty Traces Generated

**Symptom**: Trace has 0 execution steps

**Cause**: Usually means Valgrind didn't match source filename

**Check**: Lambda logs should show if vgtrace file was generated:
```bash
aws logs tail /aws/lambda/spp-trace-executor-dev --since 5m | grep vgtrace
```

**Solution**: This should already be fixed in the handler (using basename), but if issue persists, check handler.py line 190.

### Out of Memory Errors

**Symptoms**:
```
Runtime exited with error: signal: killed Runtime.ExitError
```

**Solution**: Increase Lambda memory

```bash
aws lambda update-function-configuration \
  --function-name spp-trace-executor-dev \
  --memory-size 5120  # 5GB
```

## Cost Analysis

### Estimated Monthly Costs (100K requests/month)

| Resource | Cost |
|----------|------|
| Lambda Invocations | $2.00 |
| Lambda Duration (3s @ 3GB) | $10.50 |
| ECR Storage | $0.30 |
| S3 Cache | $0.50 |
| CloudWatch Logs | $1.00 |
| **Total** | **~$14.30/month** |

**With 50% cache hit rate**: ~$10/month

**Compare to Fargate**: ~$30/month for 24/7 availability

## Updating the Lambda Function

When you make changes to the handler or Valgrind:

```bash
# Rebuild image
./build-docker.sh

# Redeploy (will update existing function)
./deploy-to-aws.sh dev
```

The script detects existing functions and performs an update instead of creating new ones.

## Deploying to Production

```bash
# Deploy to prod environment
./deploy-to-aws.sh prod

# Update backend .env
EXEC_MODE=lambda
LAMBDA_FUNCTION_NAME=spp-trace-executor-prod
AWS_REGION=us-west-2

# In production, use IAM roles instead of access keys
# (ECS task role, EC2 instance role, etc.)
```

## Cleanup

To remove all AWS resources:

```bash
# Delete Lambda function
aws lambda delete-function --function-name spp-trace-executor-dev

# Delete IAM role
aws iam detach-role-policy \
  --role-name spp-lambda-execution-role-dev \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name spp-lambda-execution-role-dev

# Delete ECR images
aws ecr batch-delete-image \
  --repository-name spp-lambda-trace \
  --image-ids imageTag=dev imageTag=latest

# Delete ECR repository
aws ecr delete-repository --repository-name spp-lambda-trace
```

## Next Steps

1. **Set up CI/CD**: Automate deployment with GitHub Actions
2. **Enable X-Ray**: Add distributed tracing for debugging
3. **Configure Alarms**: CloudWatch alarms for errors/throttles
4. **Add CloudFront**: Global edge caching for faster responses
5. **Implement Rate Limiting**: Protect against abuse

## Support

For issues or questions:
- Check CloudWatch logs: `aws logs tail /aws/lambda/spp-trace-executor-dev --follow`
- Review Lambda metrics in AWS Console
- Test locally with `test-handler-simple.py`
- Review backend logs for connection issues
