import { 
    ECSClient, 
    RunTaskCommand, 
    TaskOverride,
} from "@aws-sdk/client-ecs";
import { waitUntilTasksStopped } from "@aws-sdk/client-ecs";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { TraceRunner, RunnerResult } from "./runner.interface";

export class FargateRunner implements TraceRunner {
    private ecsClient: ECSClient;
    private s3Client: S3Client;
    private bucketName: string;
    private clusterArn: string;
    private taskDefinitionArn: string;
    private subnets: string[];
    private securityGroup: string;

    constructor() {
        const region = process.env.AWS_REGION || "us-west-2";
        this.ecsClient = new ECSClient({ region });
        this.s3Client = new S3Client({ region });
        
        this.bucketName = process.env.TRACESTORE_NAME!;
        this.clusterArn = process.env.CLUSTER_ARN!;
        this.taskDefinitionArn = process.env.TASK_DEF_ARN!;
        this.subnets = (process.env.SUBNETS || "").split(",").filter(s => s);
        this.securityGroup = process.env.SECURITY_GROUP!;

        this.validateConfig();
    }

    async run(code: string, uniqueId: string): Promise<RunnerResult> {
        const codeKey = `${uniqueId}/${uniqueId}_code.cpp`;
        const traceKey = `${uniqueId}/${uniqueId}_trace.json`;
        const ccStdoutKey = `${uniqueId}/${uniqueId}_cc_stdout.txt`;
        const ccStderrKey = `${uniqueId}/${uniqueId}_cc_stderr.txt`;
        const stdoutKey = `${uniqueId}/${uniqueId}_stdout.txt`;
        const stderrKey = `${uniqueId}/${uniqueId}_stderr.txt`;

        // Upload code to S3
        await this.s3Client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: codeKey,
            Body: code,
            ServerSideEncryption: "aws:kms"
        }));

        // Run Fargate task
        const taskArn = await this.runFargateTask(uniqueId,
                                                  codeKey,
                                                  traceKey,
                                                  ccStdoutKey,
                                                  ccStderrKey,
                                                  stdoutKey,
                                                  stderrKey);

        // Wait for task completion
        await waitUntilTasksStopped(
            { client: this.ecsClient, maxWaitTime: 300 },
            { cluster: this.clusterArn, tasks: [taskArn] }
        );

        // Download results from S3
        const [ccStdout, ccStderr, stdout, stderr, traceContent] = await Promise.all([
            this.downloadFromS3(ccStdoutKey),
            this.downloadFromS3(ccStderrKey),
            this.downloadFromS3(stdoutKey),
            this.downloadFromS3(stderrKey),
            this.downloadFromS3(traceKey)
        ]);

        return {
            ccStdout,
            ccStderr,
            stdout,
            stderr,
            traceContent
        };
    }

    private async runFargateTask(
        uniqueId: string, 
        codeKey: string, 
        traceKey: string,
        ccStdoutKey: string,
        ccStderrKey: string,
        stdoutKey: string,
        stderrKey: string
    ): Promise<string> {
        const overrides: TaskOverride = {
            containerOverrides: [{
                name: "code-runner",
                environment: [
                    { name: "TRACESTORE_NAME", value: this.bucketName },
                    { name: "CODE_KEY", value: codeKey },
                    { name: "TRACE_KEY", value: traceKey },
                    { name: "CC_STDOUT_KEY", value: ccStdoutKey },
                    { name: "CC_STDERR_KEY", value: ccStderrKey },
                    { name: "STDOUT_KEY", value: stdoutKey },
                    { name: "STDERR_KEY", value: stderrKey }
                ]
            }]
        };

        const response = await this.ecsClient.send(new RunTaskCommand({
            cluster: this.clusterArn,
            taskDefinition: this.taskDefinitionArn,
            launchType: "FARGATE",
            networkConfiguration: {
                awsvpcConfiguration: {
                    subnets: this.subnets,
                    securityGroups: [this.securityGroup],
                    assignPublicIp: "DISABLED"
                }
            },
            overrides
        }));

        if (!response.tasks || response.tasks.length === 0) {
            throw new Error("Failed to launch Fargate task");
        }

        return response.tasks[0].taskArn!;
    }

    private async downloadFromS3(key: string): Promise<string> {
        try {
            const response = await this.s3Client.send(new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key
            }));

            if (!response.Body) {
                return "";
            }

            return await response.Body.transformToString();
        } catch (error: any) {
            // File might not exist if compilation failed
            if (error.name === "NoSuchKey") {
                return "";
            }
            throw error;
        }
    }

    private validateConfig() {
        const required = [
            { name: "BUCKET", value: this.bucketName },
            { name: "CLUSTER_ARN", value: this.clusterArn },
            { name: "TASK_DEF_ARN", value: this.taskDefinitionArn },
            { name: "SUBNETS", value: this.subnets.length > 0 ? "set" : "" },
            { name: "SECURITY_GROUP", value: this.securityGroup }
        ];

        const missing = required.filter(r => !r.value);
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.map(m => m.name).join(", ")}`);
        }
    }
}