# See++ Lambda Trace Executor

AWS Lambda-based C++ trace execution using Valgrind 3.27.0 on Amazon Linux 2023.

## Overview

This Lambda function replaces the Fargate-based trace execution with a faster, more cost-effective solution:

| Feature | Fargate | Lambda |
|---------|---------|--------|
| **Cold Start** | 30-60s | 3-5s |
| **Warm Start** | N/A | <1s |
| **Cost** | Always running | Pay per execution |
| **Timeout** | Unlimited | 15 minutes max |
| **Memory** | 2GB fixed | Up to 10GB |
| **Scaling** | Manual | Automatic |

## Architecture

```
┌──────────────┐        ┌──────────────┐        ┌────────────────────┐
│              │        │              │        │                    │
│   Frontend   │───────▶│ API Gateway  │───────▶│  Lambda Function   │
│              │        │              │        │                    │
└──────────────┘        └──────────────┘        │  - Compile C++     │
                                                 │  - Run Valgrind    │
                                                 │  - Generate trace  │
                                                 │                    │
                                                 └─────────┬──────────┘
                                                           │
                                                           ▼
                                                 ┌──────────────────┐
                                                 │   S3 Cache       │
                                                 │  (Optional)      │
                                                 └──────────────────┘
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **AWS SAM CLI** installed: `pip install aws-sam-cli`
3. **Docker** installed and running
4. **Built Valgrind** in `../valgrind` directory

## Build and Test Locally

### 1. Build the Docker image

```bash
# From code-runner-new/lambda directory
sam build
```

This will:
- Build the Lambda container image
- Copy Valgrind 3.27.0 from `../valgrind`
- Install all dependencies
- Package the handler

### 2. Test locally with SAM

```bash
# Start local API Gateway
sam local start-api

# Test with curl
curl -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"code": "int main() { int x = 42; return 0; }"}'
```

### 3. Invoke function directly

```bash
# Create test event
cat > test-event.json <<EOF
{
  "body": "{\"code\": \"int main() { int x = 42; return 0; }\"}"
}
EOF

# Invoke locally
sam local invoke TraceExecutionFunction -e test-event.json
```

## Deploy to AWS

### Development Deployment

```bash
sam deploy \
  --guided \
  --parameter-overrides Environment=dev
```

The `--guided` flag will prompt you for:
- Stack name
- AWS Region
- Confirm changes before deploy
- Save configuration to samconfig.toml

### Production Deployment

```bash
sam deploy \
  --config-env prod \
  --parameter-overrides Environment=prod
```

### Deploy with CI/CD

```bash
sam deploy \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --stack-name spp-lambda-prod \
  --region us-west-2 \
  --parameter-overrides Environment=prod \
  --capabilities CAPABILITY_IAM
```

## Configuration

### Environment Variables

Set in `template.yaml`:

- `CACHE_BUCKET`: S3 bucket for result caching
- `ENVIRONMENT`: Deployment environment (dev/test/prod)

### Memory and Timeout

Adjust in `template.yaml`:

```yaml
Globals:
  Function:
    Timeout: 180      # 3 minutes (max: 900s)
    MemorySize: 3008  # ~3GB (max: 10240MB)
```

Higher memory = faster CPU allocation from AWS.

### API Gateway

CORS is enabled by default for all origins. Adjust in `template.yaml`:

```yaml
Cors:
  AllowMethods: "'POST, OPTIONS'"
  AllowHeaders: "'Content-Type'"
  AllowOrigin: "'https://yourdomain.com'"  # Restrict to specific domain
```

## Performance Optimization

### 1. Keep Lambdas Warm

Use CloudWatch Events to ping the function every 5 minutes:

```bash
aws events put-rule \
  --name keep-trace-lambda-warm \
  --schedule-expression "rate(5 minutes)"

aws lambda add-permission \
  --function-name spp-trace-executor-prod \
  --statement-id keep-warm \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com
```

### 2. Enable Provisioned Concurrency

For consistent sub-second response times:

```bash
aws lambda put-provisioned-concurrency-config \
  --function-name spp-trace-executor-prod \
  --provisioned-concurrent-executions 2
```

Cost: ~$12/month per provisioned instance.

### 3. S3 Caching

Results are automatically cached by SHA-256 hash of the code:
- First run: Full compilation + execution (~2-5s)
- Cached run: Instant response (<100ms)

Cache lifetime: 90 days (configurable in `template.yaml`)

## Integration with Backend

### Update backend/src/runners/lambda.ts

Create a new Lambda runner:

```typescript
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

export class LambdaRunner implements TraceRunner {
    private lambdaClient: LambdaClient;
    private functionName: string;

    constructor() {
        this.lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
        this.functionName = process.env.LAMBDA_FUNCTION_NAME!;
    }

    async run(code: string, uniqueId: string): Promise<RunnerResult> {
        const payload = JSON.stringify({ code });

        const command = new InvokeCommand({
            FunctionName: this.functionName,
            Payload: Buffer.from(payload),
        });

        const response = await this.lambdaClient.send(command);
        const result = JSON.parse(Buffer.from(response.Payload!).toString());

        if (!result.success) {
            throw new Error(result.error);
        }

        return {
            ccStdout: result.ccStdout,
            ccStderr: result.ccStderr,
            stdout: result.stdout,
            stderr: result.stderr,
            traceContent: JSON.stringify(result.trace)
        };
    }
}
```

### Update backend/src/index.ts

```typescript
// Add Lambda mode
if (process.env.EXEC_MODE === 'lambda') {
    runner = new LambdaRunner();
}
```

### Environment Variables

Add to backend:

```bash
EXEC_MODE=lambda
LAMBDA_FUNCTION_NAME=spp-trace-executor-prod
AWS_REGION=us-west-2
```

## Monitoring

### CloudWatch Logs

```bash
# Tail logs
sam logs -n TraceExecutionFunction --tail

# View logs for specific invocation
aws logs filter-log-events \
  --log-group-name /aws/lambda/spp-trace-executor-prod \
  --start-time $(date -u -d '5 minutes ago' +%s)000
```

### Metrics

Key metrics to monitor:
- **Duration**: Execution time (target: <5s)
- **Errors**: Failed invocations
- **Throttles**: Rate limit hits
- **ConcurrentExecutions**: Active lambdas

## Cost Estimation

Assuming 100,000 requests/month:

| Resource | Cost |
|----------|------|
| Lambda Invocations | $2.00 |
| Lambda Duration (3s @ 3GB) | $10.50 |
| API Gateway | $3.50 |
| S3 Storage (10GB) | $0.23 |
| S3 Requests | $0.50 |
| **Total** | **~$16.73/month** |

With caching (50% cache hit rate):
- **Total: ~$10/month**

Compare to Fargate: ~$30/month for 24/7 availability.

## Troubleshooting

### Build fails with "Valgrind not found"

Ensure Valgrind is built in `../valgrind`:

```bash
cd ../valgrind
./autogen.sh
./configure
make -j$(nproc)
```

### Lambda timeout errors

Increase timeout in `template.yaml`:

```yaml
Timeout: 300  # 5 minutes
```

### Memory errors

Increase memory allocation:

```yaml
MemorySize: 5120  # 5GB
```

### Valgrind crashes

Check CloudWatch logs for Valgrind stderr output. May need to adjust Valgrind flags in `handler.py`.

## Cleanup

```bash
# Delete stack
sam delete --stack-name spp-lambda-dev

# Delete S3 cache bucket
aws s3 rb s3://spp-trace-cache-dev-<account-id> --force
```

## Next Steps

1. **Test with all example programs** in `../tests/examples/`
2. **Benchmark performance** vs Fargate
3. **Set up CI/CD** with GitHub Actions
4. **Enable X-Ray tracing** for detailed performance analysis
5. **Add CloudFront** for global edge caching
