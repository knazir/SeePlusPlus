# See++ Deployment Guide

This guide documents how to deploy See++ to AWS using AWS Lambda for code execution (recommended) or Fargate as a fallback option.

## Overview

See++ uses **AWS Lambda** as the primary code execution method for all environments:
- **Faster execution**: Lambda containers start in 1-3 seconds vs 30-60 seconds for Fargate
- **Lower costs**: Pay only for execution time, no idle container costs
- **Auto-scaling**: Handles concurrent executions automatically up to 1000+
- **Modern stack**: Uses Valgrind 3.27.0 and Amazon Linux 2023

> **Note**: For legacy Fargate-based deployment (not recommended), see [Fargate Deployment Guide](./deployment-fargate.md)

## Architecture

```
Frontend → Backend (ECS) → Lambda Function (spp-trace-executor-test)
                            ├── Valgrind 3.27.0
                            ├── GCC/G++ compiler
                            └── Python handler
```

## Prerequisites

- AWS CLI configured with credentials
- Docker installed and running
- Copilot CLI installed
- Valgrind submodule checked out at `code-runner/lambda/SPP-Valgrind`

## Deployment Steps

### 1. Build and Deploy Lambda Function

The Lambda deployment is automated via the `deploy-to-aws.sh` script. Deploy to each environment (test, prod):

```bash
cd code-runner/lambda

# Deploy to test environment
./deploy-to-aws.sh test us-west-2

# Deploy to production environment
./deploy-to-aws.sh prod us-west-2
```

This script:
- Creates ECR repository `spp-lambda-trace` if it doesn't exist
- Builds production Docker image using multi-stage build (~394MB)
- Pushes image to ECR with environment tag (`test` or `prod`)
- Creates IAM execution role `spp-lambda-execution-role-{env}`
- Creates/updates Lambda function `spp-trace-executor-{env}`
- Configures function with:
  - Memory: 3008 MB
  - Timeout: 180 seconds (3 minutes)
  - Architecture: x86_64

**Expected Output:**
```
Lambda function created: spp-trace-executor-{env}
Function ARN: arn:aws:lambda:us-west-2:ACCOUNT_ID:function:spp-trace-executor-{env}
State: Active
```

### 2. Configure Backend for Lambda Execution

The backend must be configured to invoke Lambda instead of launching Fargate tasks.

#### 2.1. Environment Variables

Environment variables are set in `copilot/backend/manifest.yml`:

```yaml
environments:
  test:
    count: 1
    deployment:
      rolling: "recreate"
    variables:
      EXEC_MODE: lambda                              # Use Lambda instead of Fargate
      LAMBDA_FUNCTION_NAME: spp-trace-executor-test  # Function to invoke
```

#### 2.2. IAM Permissions

Lambda invoke permissions are granted via the Copilot addons system in `copilot/backend/addons/lambda-permissions.yml`:

```yaml
Resources:
  LambdaInvokePolicy:
    Type: AWS::IAM::ManagedPolicy
    Properties:
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: LambdaInvokeFunction
            Effect: Allow
            Action:
              - lambda:InvokeFunction
            Resource: '*'
```

**Note:** IAM permissions defined in `manifest.yml`'s `task_role.policy` section are **not applied** by Copilot. You must use the addons system for custom IAM policies.

### 3. Deploy Backend

Deploy the backend with the updated configuration:

```bash
copilot svc deploy --name backend --env test
```

This will:
- Update backend environment variables
- Attach Lambda invoke policy to backend task role
- Restart backend tasks with new configuration

**Verify deployment:**
```bash
# Check IAM policy attachment
aws iam list-attached-role-policies \
  --role-name spp-test-backend-TaskRole-XXXXXXXXXX \
  --region us-west-2

# Should include:
# - LambdaInvokePolicy-XXXXXXXXXX
# - tracestoreAccessPolicy-XXXXXXXXXX
```

## Testing

### Manual Lambda Invocation

Test the Lambda function directly:

```bash
aws lambda invoke \
  --function-name spp-trace-executor-test \
  --region us-west-2 \
  --payload '{"code":"#include <iostream>\nint main() { std::cout << \"Hello Lambda!\"; return 0; }"}' \
  response.json

cat response.json
```

### End-to-End Test

1. Visit the test frontend: `https://test.seepluspl.us`
2. Submit C++ code
3. Verify execution completes in 1-3 seconds
4. Check CloudWatch logs for Lambda execution:

```bash
aws logs tail /aws/lambda/spp-trace-executor-test --follow
```

## Troubleshooting

### Error: "Not authorized to perform: lambda:InvokeFunction"

**Cause:** Backend task role doesn't have Lambda invoke permissions

**Fix:**
1. Verify `copilot/backend/addons/lambda-permissions.yml` exists
2. Redeploy backend: `copilot svc deploy --name backend --env test`
3. Verify policy attachment:
   ```bash
   aws iam list-attached-role-policies --role-name spp-test-backend-TaskRole-XXXXXXXXXX
   ```

### Error: "Function not found"

**Cause:** Lambda function doesn't exist or wrong name configured

**Fix:**
1. Verify function exists:
   ```bash
   aws lambda get-function --function-name spp-trace-executor-test --region us-west-2
   ```
2. Check `LAMBDA_FUNCTION_NAME` in backend manifest matches function name

### Lambda Timeout

**Cause:** Code execution exceeds 180-second limit

**Fix:**
1. Increase timeout in `deploy-to-aws.sh` (line with `--timeout`)
2. Update function configuration:
   ```bash
   aws lambda update-function-configuration \
     --function-name spp-trace-executor-test \
     --timeout 300
   ```

### Image Too Large (>10GB)

**Cause:** Lambda has 10GB image size limit

**Fix:**
- Use production Dockerfile (`Dockerfile.prod`) which is ~394MB
- Development Dockerfile (`Dockerfile.dev`) is 2.15GB and too large

## Updating Lambda Code

When Valgrind or handler code changes:

```bash
cd code-runner/lambda
./build-docker.sh  # Build locally first to verify
./deploy-to-aws.sh test us-west-2  # Push and update Lambda
```

Lambda will automatically use the new image on next invocation (no restart needed).

## Cost Optimization

Lambda pricing (us-west-2):
- **Requests:** $0.20 per 1M requests
- **Duration:** $0.0000166667 per GB-second

At 3GB memory allocation:
- 1 second execution = ~$0.00005
- 1000 executions = ~$0.05

Compared to Fargate:
- Fargate: ~$0.04/hour for 1 vCPU, 2GB (minimum ~$30/month even at low usage)
- Lambda: Pay only for execution (~$0.05/1000 runs)

**Recommendation:** Use Lambda for test/dev, Fargate for production with consistent traffic.

## Files Reference

### Lambda Code
- `code-runner/lambda/handler.py` - Lambda entry point
- `code-runner/lambda/Dockerfile.prod` - Production multi-stage build
- `code-runner/lambda/Dockerfile.dev` - Development single-stage build
- `code-runner/lambda/build-docker.sh` - Local build script
- `code-runner/lambda/deploy-to-aws.sh` - Deploy to AWS script
- `code-runner/lambda/SPP-Valgrind/` - Valgrind 3.27.0 source (git submodule)

### Backend Configuration
- `copilot/backend/manifest.yml` - Backend service configuration
- `copilot/backend/addons/lambda-permissions.yml` - IAM permissions for Lambda invoke
- `backend/src/services/lambda-runner.ts` - Lambda invocation logic

## Execution Method Comparison

| Feature | Lambda (Recommended) | Fargate (Legacy) |
|---------|----------------------|------------------|
| Execution Mode | Lambda container | Fargate task |
| Cold Start | 1-3 seconds | 30-60 seconds |
| Cost Model | Per-invocation (~$0.00005/run) | Per-hour (~$0.04/hour minimum) |
| Concurrency | Auto-scales to 1000+ | Manual scaling (1-10) |
| Valgrind Version | 3.27.0 (modern) | 3.14.0 (legacy) |
| Base Image | Amazon Linux 2023 | Ubuntu 14.04 |
| Memory | 3008 MB | 2048 MB |
| Timeout | 180 seconds | 300 seconds |
| Deployment | All environments | Legacy fallback only |

> **Recommendation**: Use Lambda for all new deployments. Fargate support is maintained for backward compatibility only.

## Next Steps

- Monitor Lambda performance in CloudWatch
- Adjust memory/timeout based on actual usage patterns
- Consider migrating production to Lambda if test performance is satisfactory
- Set up CloudWatch alarms for Lambda errors/throttling
