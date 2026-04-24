import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TraceRunner, RunnerResult } from "./runner.interface";

const execPromise = util.promisify(exec);

export class LocalDockerRunner implements TraceRunner {
    private readonly rootSharedDir: string = "/tmp/spp-usercode";
    private readonly userCodeFilePrefix: string = process.env.USER_CODE_FILE_PREFIX || "main";
    private readonly userCodeImageName: string = "spp-code-runner-local:dev";
    private readonly userCodeNetworkName: string = "spp_no-internet";

    constructor() {
        if (!fs.existsSync(this.rootSharedDir)) {
            fs.mkdirSync(this.rootSharedDir, { recursive: true });
        }
    }

    async run(code: string, uniqueId: string): Promise<RunnerResult> {
        // Create input and output directories
        const inputDir = path.join(this.rootSharedDir, uniqueId, "input");
        const outputDir = path.join(this.rootSharedDir, uniqueId, "output");

        fs.mkdirSync(inputDir, { recursive: true });
        fs.mkdirSync(outputDir, { recursive: true });

        // Write code to input file
        const codeFile = path.join(inputDir, "main.cpp");
        fs.writeFileSync(codeFile, code);

        // Initialize output files
        const traceFile = path.join(outputDir, "main_vgtrace.txt");
        const ccStdoutFile = path.join(outputDir, "main_cc_out.txt");
        const ccStderrFile = path.join(outputDir, "main_cc_err.txt");
        const stdoutFile = path.join(outputDir, "main_out.txt");
        const stderrFile = path.join(outputDir, "main_err.txt");

        try {
            // Run container with directory mounts
            const dockerCmd = [
                "docker run",
                "--rm",
                `--network ${this.userCodeNetworkName}`,
                `-v ${inputDir}:/input:ro`,      // Read-only code input
                `-v ${outputDir}:/output:rw`,    // Read-write output
                this.userCodeImageName
            ].join(" ");

            // The container exits non-zero when the user's code fails to compile,
            // which makes exec throw. But the container DOES get to write gcc's
            // stderr to `main_cc_err.txt` before exiting, so we swallow the
            // throw here and decide what to do after reading the output files.
            let dockerError: Error | null = null;
            try {
                await execPromise(dockerCmd);
            } catch (err) {
                dockerError = err as Error;
            }

            // Read results
            const ccStdout = fs.existsSync(ccStdoutFile) ? fs.readFileSync(ccStdoutFile, "utf-8") : "";
            const ccStderr = fs.existsSync(ccStderrFile) ? fs.readFileSync(ccStderrFile, "utf-8") : "";

            // No compile output + docker throw => genuine orchestration failure
            // (image missing, daemon down, permission error on the mount, etc.).
            // Re-throw so it surfaces as a 500. Compile failures will have
            // ccStderr populated, so we fall through and let buildValgrindResponse
            // turn that into a proper UncaughtException trace.
            if (dockerError && ccStderr.trim().length === 0) {
                throw dockerError;
            }

            let stdout = "";
            let stderr = "";
            let traceContent = "";

            const hasCompilerError = ccStderr.trim().length > 0;
            if (!hasCompilerError) {
                traceContent = fs.existsSync(traceFile) ? fs.readFileSync(traceFile, "utf-8") : "";
                stdout = fs.existsSync(stdoutFile) ? fs.readFileSync(stdoutFile, "utf-8") : "";
                stderr = fs.existsSync(stderrFile) ? fs.readFileSync(stderrFile, "utf-8") : "";
            }

            return {
                ccStdout,
                ccStderr,
                stdout,
                stderr,
                traceContent
            };
        } finally {
            // Cleanup directories
            try {
                fs.rmSync(path.join(this.rootSharedDir, uniqueId), { recursive: true, force: true });
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }

}