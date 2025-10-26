# See++ Fargate Deployment Guide (Legacy)

> **⚠️ LEGACY DOCUMENTATION**: This guide describes the original Fargate-based deployment method, which is no longer recommended. Fargate has 30-60 second cold starts and higher costs compared to Lambda.
>
> **For new deployments, use the [Lambda Deployment Guide](./deployment.md) instead**, which provides 1-3 second execution times and lower costs.
>
> This documentation is maintained for backward compatibility and migration reference only.

This guide covers the legacy Fargate-based deployment of See++ to AWS using AWS Copilot.

## Prerequisites

Before deploying, ensure you have:

### Required Tools
- **AWS CLI**: [Installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- **AWS Copilot CLI**: [Installation guide](https://aws.github.io/copilot-cli/docs/getting-started/install/)
- **Docker**: For building and pushing images
- **Git**: For repository access

### AWS Account Setup
- Valid AWS account with appropriate permissions
- AWS CLI configured with credentials
- Sufficient AWS service limits for ECS, S3, and ECR

## Deployment Overview

See++ uses AWS Copilot for infrastructure as code. The deployment process involves:

1. **Initial Setup**: Copilot application and environment creation
2. **Manual Configuration**: IAM roles, secrets, and infrastructure tweaks
3. **Service Deployment**: Deploy backend and frontend services
4. **Code Runner Setup**: Configure isolated execution environment
5. **Testing and Verification**: Ensure everything works correctly

## Environment Structure

### Supported Environments
- **test**: Testing/staging environment
- **prod**: Production environment

### Service Architecture
```
├── Application: spp
│   ├── Environment: test
│   │   ├── Service: backend
│   │   ├── Service: frontend-legacy
│   │   ├── Service: frontend (new)
│   │   └── Addon: trace-store (S3)
│   └── Environment: prod
│       ├── Service: backend
│       ├── Service: frontend-legacy
│       ├── Service: frontend (new)
│       └── Addon: trace-store (S3)
```

## Step-by-Step Deployment

### 1. Initial Copilot Setup

#### Initialize Application (First Time Only)
```bash
# Navigate to project root
cd SeePlusPlus

# Initialize Copilot application
copilot app init spp
```

#### Create Environment
```bash
# Create test environment
copilot env init --name test
copilot env deploy --name test

# Create production environment
copilot env init --name prod
copilot env deploy --name prod
```

### 2. Deploy Services

Before deploying services, you'll want to configure your domain settings in the Copilot manifests.

#### Configure Domains (Optional)

If you want to use custom domains instead of the default Copilot-generated URLs:

1. **Update Frontend Legacy Manifest** (`copilot/frontend-legacy/manifest.yml`):
   ```yaml
   environments:
     prod:
       http:
         alias: ["your-domain.com", "legacy.your-domain.com"]
   ```

2. **Update Frontend Manifest** (`copilot/frontend/manifest.yml`):
   ```yaml
   environments:
     prod:
       http:
         alias: ["beta.your-domain.com"]
   ```

3. **DNS Configuration**: Ensure your domain's DNS is configured to point to the AWS load balancer that Copilot creates.

#### Deploy Backend Service
```bash
# Deploy to test
copilot svc deploy --name backend --env test

# Deploy to production
copilot svc deploy --name backend --env prod
```

#### Deploy Frontend Service
```bash
# Deploy legacy frontend to test
copilot svc deploy --name frontend-legacy --env test

# Deploy legacy frontend to production
copilot svc deploy --name frontend-legacy --env prod

# Deploy new frontend to test
copilot svc deploy --name frontend --env test

# Deploy new frontend to production
copilot svc deploy --name frontend --env prod
```

### 3. Manual Configuration Steps

After the initial Copilot deployment, several manual steps are required for each environment:

#### Step 3.1: Configure IAM Roles

**Backend Execution Role Policies**

Navigate to AWS IAM Console and add these policies to the backend execution role:

```json
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
            "Resource": "arn:aws:s3:::YOUR-TRACE-BUCKET-NAME/*"
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
```

**Backend Task Role Policies**

Add the same policy to the backend task role.

**DenyIAM Policy for Backend Task Role**

Add this deny policy to prevent privilege escalation:

```json
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
```

#### Step 3.2: Configure Load Balancer

1. Navigate to EC2 → Load Balancers in AWS Console
2. Find the load balancer for your environment
3. Edit attributes
4. Change **Idle timeout** from 60 seconds to **300 seconds**

#### Step 3.3: Setup Secrets

Configure these secrets in AWS Systems Manager Parameter Store:

```bash
# Replace [ENV] with 'test' or 'prod'
# Replace values with your actual infrastructure ARNs/IDs

aws ssm put-parameter \
  --name "/copilot/spp/[ENV]/secrets/CLUSTER_ARN" \
  --value "arn:aws:ecs:us-west-2:ACCOUNT-ID:cluster/CLUSTER-NAME" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/copilot/spp/[ENV]/secrets/ECR_REPO" \
  --value "ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/spp-code-runner" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/copilot/spp/[ENV]/secrets/SECURITY_GROUP" \
  --value "sg-YOUR-SECURITY-GROUP-ID" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/copilot/spp/[ENV]/secrets/SUBNETS" \
  --value "subnet-AAAA,subnet-BBBB,subnet-CCCC" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/copilot/spp/[ENV]/secrets/TASK_DEF_ARN" \
  --value "arn:aws:ecs:us-west-2:ACCOUNT-ID:task-definition/spp-code-runner-task-[ENV]" \
  --type "SecureString"
```

**How to Find These Values:**

1. **CLUSTER_ARN**: ECS Console → Clusters → Select cluster → Copy ARN
2. **ECR_REPO**: ECR Console → Repositories → Create/find spp-code-runner repo
3. **SECURITY_GROUP**: EC2 Console → Security Groups → Find backend security group
4. **SUBNETS**: VPC Console → Subnets → Private subnets from your environment
5. **TASK_DEF_ARN**: Created in Step 3.5

#### Step 3.4: Setup ECR Repository

```bash
# Create ECR repository for code runner images
aws ecr create-repository \
  --repository-name spp-code-runner \
  --region us-west-2

# Set lifecycle policy to manage costs
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
```

#### Step 3.5: Register Code Runner Task Definition

Create the task definition file:

**For Test Environment (`task-def.test.json`)**:
```json
{
    "family": "spp-code-runner-task-test",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048",
    "runtimePlatform": {
        "operatingSystemFamily": "LINUX",
        "cpuArchitecture": "X86_64"
    },
    "executionRoleArn": "arn:aws:iam::YOUR-ACCOUNT-ID:role/spp-test-backend-ExecutionRole-XXXXX",
    "taskRoleArn": "arn:aws:iam::YOUR-ACCOUNT-ID:role/spp-test-backend-TaskRole-XXXXX",
    "containerDefinitions": [
      {
        "name": "spp-code-runner",
        "image": "YOUR-ACCOUNT-ID.dkr.ecr.us-west-2.amazonaws.com/spp-code-runner:test",
        "essential": true,
        "logConfiguration": {
          "logDriver": "awslogs",
          "options": {
            "awslogs-group": "/ecs/spp-code-runner",
            "awslogs-region": "us-west-2",
            "awslogs-stream-prefix": "ecs",
            "awslogs-create-group": "true"
          }
        },
        "environment": []
      }
    ]
}
```

Register the task definition:
```bash
aws ecs register-task-definition --cli-input-json file://task-def.test.json
aws ecs register-task-definition --cli-input-json file://task-def.prod.json
```

#### Step 3.6: Set S3 Bucket Retention Policy

```bash
# Find your trace bucket name
aws s3 ls | grep trace

# Set lifecycle policy for automatic cleanup
aws s3api put-bucket-lifecycle-configuration \
  --bucket YOUR-TRACE-BUCKET-NAME \
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
```

### 4. Code Runner Deployment

Use the localdev.sh script to deploy the code runner:

```bash
# Set required environment variables
export AWS_REGION=us-west-2
export AWS_ACCOUNT_ID=your-account-id
export ECR_REPO=your-account-id.dkr.ecr.us-west-2.amazonaws.com/spp-code-runner

# Deploy code runner to test
./localdev.sh deploy test code-runner

# Deploy code runner to production
./localdev.sh deploy prod code-runner
```

This will:
1. Build the code runner image for linux/amd64 platform
2. Log in to ECR
3. Push the image with appropriate tags

### 5. Service Deployment

Deploy application services:

```bash
# Deploy all services to test
./localdev.sh deploy test

# Deploy all services to production (includes both frontends)
./localdev.sh deploy prod

# Deploy specific services
./localdev.sh deploy test backend
./localdev.sh deploy prod frontend-legacy
./localdev.sh deploy prod frontend  # New frontend
```

## Environment-Specific Configuration

### Test Environment
- **Domain**: `*.test.[your-app-name].[your-domain.com]`
- **Scaling**: Fixed 1 instance per service
- **Deployment**: Recreate strategy for faster deployments
- **SSL**: AWS-managed certificate

### Production Environment
- **Domain**: `[your-domain.com]` (primary - legacy frontend)
- **Beta Domain**: `beta.[your-domain.com]` (new frontend, when deployed)
- **Legacy Alias**: `legacy.[your-domain.com]` (optional alias for legacy frontend)
- **Scaling**: Auto-scaling 1-10 instances
- **Deployment**: Rolling updates for zero downtime
- **SSL**: AWS-managed certificate

**Note**: The new frontend service is under development and may be deployed to a beta subdomain for testing purposes. Check your Copilot service configurations for the actual domain mappings in your environment. You'll need to configure your own domain names in the Copilot service manifests.

**Domain Configuration**: 
- Update `copilot/frontend-legacy/manifest.yml` to set your domain aliases
- Update `copilot/frontend/manifest.yml` for the new frontend domain  
- Ensure your domain's DNS is configured to point to the AWS load balancer

**Example Domain Configurations**:

For legacy frontend (`copilot/frontend-legacy/manifest.yml`):
```yaml
environments:
  prod:
    http:
      alias: ["your-domain.com", "legacy.your-domain.com"]
```

For new frontend (`copilot/frontend/manifest.yml`):
```yaml
environments:
  prod:
    http:
      alias: ["beta.your-domain.com"]
```

**Note**: These examples show the structure. Replace `your-domain.com` with your actual domain. The new frontend service already exists and is configured for beta deployment.

## Verification and Testing

### 1. Health Checks

```bash
# Test backend health
curl https://backend.test.[your-app-name].[your-domain.com]/api
curl https://backend.prod.[your-app-name].[your-domain.com]/api

# Test legacy frontend
curl https://test.[your-app-name].[your-domain.com]/
curl https://[your-domain.com]/

# Test new frontend
curl https://beta.[your-domain.com]/
```

**Note**: Replace `[your-app-name]` with your Copilot application name (default: `spp`) and `[your-domain.com]` with your actual domain. The exact URLs will depend on your Copilot service configurations and domain setup.

### 2. Code Execution Test

1. Navigate to your frontend URL (e.g., `https://[your-domain.com]/` or `https://test.[your-app-name].[your-domain.com]/`)
2. Enter simple C++ code:
   ```cpp
   #include <iostream>
   int main() {
       std::cout << "Hello World!" << std::endl;
       return 0;
   }
   ```
3. Click "Visualize"
4. Verify execution completes and visualization appears

### 3. Log Monitoring

```bash
# View service logs
copilot svc logs --name backend --env test --follow
copilot svc logs --name frontend-legacy --env prod --follow

# View code runner logs in CloudWatch
aws logs describe-log-groups --log-group-name-prefix "/ecs/spp-code-runner"
```

## Troubleshooting

### Common Deployment Issues

#### 1. IAM Permission Errors
**Symptoms**: ECS tasks fail to start, S3 access denied
**Solution**: Verify IAM roles have correct policies attached

#### 2. Load Balancer Timeout
**Symptoms**: 504 Gateway Timeout errors during code execution
**Solution**: Increase ALB timeout to 300 seconds

#### 3. Code Runner Task Failures
**Symptoms**: Code execution hangs or fails
**Solution**: 
- Check ECR repository exists and has images
- Verify task definition is registered
- Check security group allows ECS task communication

#### 4. Secret Access Errors
**Symptoms**: Environment variables not found
**Solution**: Verify all secrets are created in Parameter Store with correct paths

### Debugging Commands

```bash
# Check Copilot application status
copilot app status

# Check environment status
copilot env status --name test

# Check service status
copilot svc status --name backend --env test

# View detailed logs
copilot svc logs --name backend --env test --since 1h

# Check ECS service details
aws ecs describe-services --cluster CLUSTER-NAME --services backend

# Check task definitions
aws ecs list-task-definitions --family-prefix spp-code-runner-task
```

## Security Considerations

### Network Security
- All ECS tasks run in private subnets
- Code runner containers have no internet access
- Security groups restrict traffic to minimum required

### IAM Security
- Principle of least privilege for all roles
- Deny policies prevent privilege escalation
- Secrets stored in Parameter Store with encryption

### Data Security
- S3 buckets use server-side encryption
- All communication uses TLS
- Temporary data automatically cleaned up

## Cost Optimization

### Resource Management
- Auto-scaling prevents over-provisioning
- S3 lifecycle policies clean up old data
- ECR lifecycle policies manage image storage

### Monitoring
- CloudWatch metrics for cost tracking
- Set up billing alarms for unexpected charges
- Regular review of resource utilization

## Maintenance

### Regular Tasks
1. **Update Dependencies**: Regular updates to base images
2. **Monitor Costs**: Weekly cost review
3. **Security Updates**: Apply security patches
4. **Performance Review**: Monitor response times and scaling

### Backup Strategy
- Infrastructure code in version control
- S3 bucket versioning enabled
- ECR image replication for disaster recovery

## Rollback Procedures

### Service Rollback
```bash
# Rollback to previous version
copilot svc rollback --name backend --env prod

# Deploy specific version
copilot svc deploy --name backend --env prod --tag previous-version
```

### Code Runner Rollback
```bash
# Tag previous image as current
docker tag spp-code-runner:previous spp-code-runner:prod
docker push ECR-REPO:prod
```

## Next Steps

For ongoing operations:
- [Infrastructure Guide](./infrastructure.md) - Detailed AWS components
- [Development Guide](./development.md) - Local development setup
- [Architecture Guide](./architecture.md) - System design overview

For advanced topics:
- Multi-region deployment
- Advanced monitoring and alerting
- Performance optimization strategies 