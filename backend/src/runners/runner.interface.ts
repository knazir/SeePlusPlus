export interface RunnerResult {
    ccStdout: string;
    ccStderr: string;
    stdout: string;
    stderr: string;
    traceContent: string;
}

export interface TraceRunner {
    run(code: string, uniqueId: string): Promise<RunnerResult>;
}