/**
 * Lambda-based trace runner for See++ backend
 *
 * This runner invokes the Lambda function instead of Fargate tasks
 * for faster cold starts and better cost efficiency.
 *
 * Usage:
 * 1. Copy this file to backend/src/runners/lambda.ts
 * 2. Update backend/src/index.ts to use LambdaRunner when EXEC_MODE=lambda
 * 3. Set environment variables:
 *    - LAMBDA_FUNCTION_NAME=spp-trace-executor-prod
 *    - AWS_REGION=us-west-2
 */

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { TraceRunner, RunnerResult } from "./runner.interface";

interface LambdaResponse {
    success: boolean;
    trace?: any;
    ccStdout: string;
    ccStderr: string;
    stdout: string;
    stderr: string;
    error?: string;
}

export class LambdaRunner implements TraceRunner {
    private lambdaClient: LambdaClient;
    private functionName: string;
    private region: string;

    constructor() {
        this.region = process.env.AWS_REGION || 'us-west-2';
        this.functionName = process.env.LAMBDA_FUNCTION_NAME!;

        if (!this.functionName) {
            throw new Error('LAMBDA_FUNCTION_NAME environment variable is required');
        }

        const clientConfig: any = { region: this.region };

        // Use explicit credentials only if provided (and not placeholder values)
        if (process.env.AWS_ACCESS_KEY_ID &&
            process.env.AWS_SECRET_ACCESS_KEY &&
            !process.env.AWS_ACCESS_KEY_ID.includes('your_') &&
            !process.env.AWS_SECRET_ACCESS_KEY.includes('your_')) {
            clientConfig.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };
        }
        // Otherwise, let SDK use default credential chain (~/.aws/credentials)

        this.lambdaClient = new LambdaClient(clientConfig);
    }

    async run(code: string, uniqueId: string): Promise<RunnerResult> {
        console.log(`Invoking Lambda function: ${this.functionName}`);
        console.log(`Unique ID: ${uniqueId}`);

        const startTime = Date.now();

        try {
            // Prepare Lambda payload
            const payload = {
                code: code,
                preprocessed: false  // Backend already handles preprocessing
            };

            // Invoke Lambda function
            const command = new InvokeCommand({
                FunctionName: this.functionName,
                Payload: Buffer.from(JSON.stringify(payload)),
                LogType: 'Tail'  // Get last 4KB of logs
            });

            const response = await this.lambdaClient.send(command);

            // Check for Lambda execution errors
            if (response.FunctionError) {
                const errorPayload = Buffer.from(response.Payload!).toString();
                console.error('Lambda execution error:', errorPayload);
                throw new Error(`Lambda execution failed: ${errorPayload}`);
            }

            // Parse response
            const responsePayload = Buffer.from(response.Payload!).toString();
            let lambdaResult: any;

            try {
                lambdaResult = JSON.parse(responsePayload);
            } catch (e) {
                console.error('Failed to parse Lambda response:', responsePayload);
                throw new Error('Invalid Lambda response format');
            }

            // Handle API Gateway response format
            if (lambdaResult.statusCode) {
                if (lambdaResult.statusCode !== 200) {
                    throw new Error(`Lambda returned status ${lambdaResult.statusCode}: ${lambdaResult.body}`);
                }
                lambdaResult = JSON.parse(lambdaResult.body);
            }

            const executionTime = Date.now() - startTime;
            console.log(`Lambda execution completed in ${executionTime}ms`);

            // Check if execution was successful
            if (!lambdaResult.success) {
                console.error('Trace generation failed:', lambdaResult.error);
                throw new Error(lambdaResult.error || 'Unknown error during trace generation');
            }

            // Log execution logs if available
            if (response.LogResult) {
                const logs = Buffer.from(response.LogResult, 'base64').toString();
                console.log('Lambda logs:', logs);
            }

            // Return in the expected format
            return {
                ccStdout: lambdaResult.ccStdout || '',
                ccStderr: lambdaResult.ccStderr || '',
                stdout: lambdaResult.stdout || '',
                stderr: lambdaResult.stderr || '',
                traceContent: JSON.stringify(lambdaResult.trace)
            };

        } catch (error: any) {
            const executionTime = Date.now() - startTime;
            console.error(`Lambda invocation failed after ${executionTime}ms:`, error);

            throw new Error(`Lambda execution error: ${error.message}`);
        }
    }

    /**
     * Health check for Lambda function
     */
    async healthCheck(): Promise<boolean> {
        try {
            const testCode = 'int main() { return 0; }';
            await this.run(testCode, 'health-check');
            return true;
        } catch (error) {
            console.error('Lambda health check failed:', error);
            return false;
        }
    }
}

/**
 * Example usage in backend/src/index.ts:
 *
 * import { LambdaRunner } from './runners/lambda';
 *
 * let runner: TraceRunner;
 *
 * if (process.env.EXEC_MODE === 'lambda') {
 *     runner = new LambdaRunner();
 * } else if (process.env.EXEC_MODE === 'fargate') {
 *     runner = new FargateRunner();
 * } else {
 *     runner = new LocalRunner();
 * }
 *
 * // Health check endpoint
 * app.get('/health', async (req, res) => {
 *     if (runner instanceof LambdaRunner) {
 *         const healthy = await runner.healthCheck();
 *         res.status(healthy ? 200 : 503).json({ healthy });
 *     } else {
 *         res.json({ healthy: true });
 *     }
 * });
 */
