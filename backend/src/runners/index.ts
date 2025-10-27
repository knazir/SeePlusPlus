import { TraceRunner } from "./runner.interface";
import { LocalDockerRunner } from "./local";
import { LambdaRunner } from "./lambda";

export function createRunner(): TraceRunner {
    const execMode = process.env.EXEC_MODE || "local";
    if (execMode === "local") {
        console.log("Using LocalDockerRunner");
        return new LocalDockerRunner();
    } else if (execMode === "lambda") {
        console.log("Using LambdaRunner");
        return new LambdaRunner();
    } else {
        throw new Error(`Unknown EXEC_MODE: ${execMode}. Valid options: local, lambda`);
    }
}

export { TraceRunner, RunnerResult } from "./runner.interface";
export { LocalDockerRunner } from "./local";
export { LambdaRunner } from "./lambda";