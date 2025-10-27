# See++ Infrastructure Guide

This document details the AWS infrastructure components that power See++ in production, including their configuration, relationships, and management.

## Infrastructure Overview

See++ uses a modern, containerized infrastructure deployed on AWS with the following key principles:
- **Isolation**: User code runs in completely isolated environments
- **Scalability**: Auto-scaling based on demand
- **Security**: Multiple layers of security controls
- **Observability**: Comprehensive logging and monitoring

## AWS Infrastructure Stack

### Core Services

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Account                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Lambda    │  │    S3       │  │        IAM          │  │
│  │ (Serverless)│  │ (Optional)  │  │  (Roles/Policies)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    ALB      │  │    ECS      │  │       VPC           │  │
│  │(Load Bal.)  │  │  (Backend)  │  │   (Networking)      │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Component Breakdown

### 1. AWS Copilot Application

**Application Name**: `spp`

AWS Copilot is used for infrastructure as code, providing:
- Environment management (test/prod)
- Service deployment and scaling
- Load balancer configuration
- VPC and networking setup

**Copilot Structure**:
```
copilot/
├── .workspace              # Application configuration
├── environments/
│   ├── test/
│   │   └── manifest.yml    # Test environment config
│   └── prod/
│       └── manifest.yml    # Production environment config
├── backend/
│   ├── manifest.yml        # Backend service config
│   └── addons/
│       └── trace-store.yml # S3 bucket addon
├── frontend-legacy/
│   └── manifest.yml        # Legacy frontend service config
└── frontend/
    └── manifest.yml        # New frontend service config
```

### 2. ECS (Elastic Container Service)

#### Frontend Services

**Legacy Frontend (frontend-legacy)**
- **Type**: Load Balanced Web Service
- **Platform**: linux/x86_64
- **Resources**: 256 CPU, 512 MB memory
- **Scaling**: 1-10 instances based on CPU (70% threshold)
- **Load Balancer**: Handles requests to main domain
- **Port**: 80 (containerized)

**New Frontend (frontend)**
- **Type**: Load Balanced Web Service
- **Platform**: linux/x86_64
- **Resources**: 256 CPU, 512 MB memory
- **Scaling**: 1-10 instances based on CPU (70% threshold)
- **Load Balancer**: Handles requests to beta subdomain
- **Port**: 80 (containerized)
- **Status**: In development, deployed to beta subdomain

#### Backend Service
- **Type**: Load Balanced Web Service
- **Platform**: linux/x86_64
- **Resources**: 256 CPU, 512 MB memory
- **Scaling**: 1-10 instances based on CPU (70% threshold)
- **Load Balancer**: Handles requests to `/api`

#### Code Runner (Lambda Function)
- **Type**: AWS Lambda (serverless)
- **Runtime**: Python 3.12 with custom container image
- **Platform**: Amazon Linux 2023 (x86_64)
- **Memory**: 10GB (10240 MB)
- **Timeout**: 120 seconds (2 minutes)
- **Execution**: Invoked synchronously by backend for each code execution
- **Concurrency**: Auto-scales up to 1000+ concurrent executions

### 3. S3 Storage (Optional - Trace Cache)

**Purpose**: Optional caching layer for frequently-executed code (not currently enabled)

**Configuration**:
- **Encryption**: AES256 server-side encryption
- **Versioning**: Enabled
- **Public Access**: Completely blocked
- **Lifecycle**: Non-current versions expire after 30 days
- **Incomplete Multipart**: Cleanup after 1 day

**Bucket Structure**:
```
s3://[bucket-name]/
└── [unique-execution-id]/
    ├── [id]_code.cpp        # User's C++ code
    ├── [id]_trace.json      # Valgrind execution trace
    ├── [id]_cc_stdout.txt   # Compilation stdout
    ├── [id]_cc_stderr.txt   # Compilation stderr
    ├── [id]_stdout.txt      # Program stdout
    └── [id]_stderr.txt      # Program stderr
```

### 4. ECR (Elastic Container Registry)

**Purpose**: Store the code-runner Docker image

**Repository**: Used for storing versioned code-runner images
- **Image Tags**: `test`, `prod` for different environments
- **Platform**: linux/amd64
- **Lifecycle**: Retention policies to manage storage costs

### 5. IAM (Identity and Access Management)

#### Backend Execution Role
Required for ECS to pull images and write logs:

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
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
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

#### Backend Task Role
Required for the backend service to operate:

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
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
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

#### DenyIAM Policy (Security)
Applied to backend task role to prevent privilege escalation:

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

### 6. Application Load Balancer (ALB)

**Configuration**:
- **Timeout**: 300 seconds (required for slow code execution)
- **Health Checks**: 
  - Frontend: `GET /`
  - Backend: `GET /api`
- **SSL/TLS**: Configured with AWS Certificate Manager
- **Domain Routing**:
  - `[your-domain.com]/` → Legacy frontend service
  - `[your-domain.com]/api/*` → Backend service
  - `beta.[your-domain.com]/` → New frontend service (when deployed)

**Note**: Replace `[your-domain.com]` with your actual domain. The exact routing depends on your Copilot service manifest configurations.

### 7. VPC and Networking

**VPC Configuration**:
- **Public Subnets**: For load balancers and internet gateways
- **Private Subnets**: For ECS tasks and resources
- **Security Groups**: Restrictive rules for each service
- **Internet Gateway**: For public internet access
- **NAT Gateway**: For private subnet internet access

**Security Groups**:
- **ALB Security Group**: Allow HTTP/HTTPS from internet
- **Backend Security Group**: Allow traffic from ALB only
- **Code Runner Security Group**: No inbound, limited outbound

## Environment-Specific Configuration

### Test Environment
- **Scaling**: Fixed to 1 instance per service
- **Domain**: `*.test.[your-domain.com]`
- **Deployment**: Recreate strategy for faster deployments
- **Monitoring**: Basic CloudWatch metrics

### Production Environment  
- **Scaling**: Auto-scaling based on demand
- **Domains**: 
  - `[your-domain.com]` (primary - legacy frontend)
  - `legacy.[your-domain.com]` (alias for legacy frontend)
  - `beta.[your-domain.com]` (new frontend, when deployed)
- **Deployment**: Rolling updates for zero downtime
- **Monitoring**: Enhanced monitoring and alerting

**Note**: The new frontend service may be deployed alongside the legacy frontend to allow for gradual migration and testing. Domain configurations can vary based on deployment strategy and must be configured in your Copilot service manifests.

## Secrets Management

### AWS Systems Manager Parameter Store

The backend service uses minimal secrets, relying on IAM roles for AWS service access. Lambda function configuration (function name, timeout, memory) is managed through environment variables in the Copilot manifest.

**No code-runner specific secrets are required** - the backend invokes Lambda functions directly using IAM role permissions.

## Monitoring and Logging

### CloudWatch Integration

**Log Groups**:
- `/copilot/spp-[env]-backend`: Backend service logs
- `/copilot/spp-[env]-frontend-legacy`: Frontend service logs
- `/aws/lambda/spp-trace-executor-[env]`: Lambda code execution logs

**Metrics**:
- ECS service CPU/memory utilization
- Application Load Balancer request metrics
- S3 bucket storage and request metrics
- Custom application metrics

### Container Insights
- Disabled by default for cost optimization
- Can be enabled for detailed container metrics

## Cost Optimization

### Resource Right-Sizing
- **Development**: Minimal resources for cost efficiency
- **Production**: Balanced for performance and cost

### Auto Scaling
- **Scale down**: During low usage periods
- **Scale up**: During high demand automatically

### Storage Lifecycle
- **S3**: Automatic cleanup of old execution traces
- **ECR**: Image lifecycle policies for old images
- **CloudWatch**: Log retention policies

## Security Best Practices

### Network Security
- **Private Subnets**: All compute resources in private subnets
- **Security Groups**: Restrictive inbound/outbound rules
- **No Internet**: Code runner containers cannot access internet

### Access Control
- **IAM Least Privilege**: Minimal required permissions
- **Service-to-Service**: Authentication via IAM roles
- **Secrets**: Stored in AWS Systems Manager

### Data Protection
- **Encryption at Rest**: S3 server-side encryption
- **Encryption in Transit**: TLS for all communications
- **Temporary Storage**: Automatic cleanup of user data

## Disaster Recovery

### Backup Strategy
- **Infrastructure**: Version-controlled Copilot configurations
- **Data**: S3 versioning for temporary data protection
- **Images**: ECR automatic replication

### Multi-Region Considerations
- **Current**: Single region deployment (us-west-2)
- **Future**: Multi-region capability via Copilot

## Troubleshooting

### Common Issues

1. **Slow Execution**: Check ECS task startup times
2. **Permission Errors**: Verify IAM roles and policies
3. **Network Issues**: Check security groups and VPC config
4. **Storage Issues**: Verify S3 bucket permissions

### Debugging Tools
- **CloudWatch Logs**: Service and application logs
- **ECS Console**: Task status and resource utilization
- **S3 Console**: File upload/download verification
- **IAM Policy Simulator**: Permission testing

## Next Steps

For operational procedures:
- [Deployment Guide](./deployment.md) - How to deploy infrastructure
- [Development Guide](./development.md) - Local development setup
- [Architecture Guide](./architecture.md) - System design overview 