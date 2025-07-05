import { TraceRunner } from "./runner.interface";
import { LocalDockerRunner } from "./local";
import { FargateRunner } from "./fargate";

export function createRunner(): TraceRunner {
    const execMode = process.env.EXEC_MODE || "local";
    console.log("EXEC_MODE: ", process.env.EXEC_MODE);
    console.log("process.env: ", process.env);
    if (execMode === "local") {
        console.log("Using LocalDockerRunner");
        return new LocalDockerRunner();
    } else if (execMode === "fargate") {
        console.log("Using FargateRunner");
        return new FargateRunner();
    } else {
        throw new Error(`Unknown EXEC_MODE: ${execMode}`);
    }
}

export { TraceRunner, RunnerResult } from "./runner.interface";
export { LocalDockerRunner } from "./local";
export { FargateRunner } from "./fargate";