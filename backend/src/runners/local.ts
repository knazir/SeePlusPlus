import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TraceRunner, RunnerResult } from "./runner.interface";

const execPromise = util.promisify(exec);

export class LocalDockerRunner implements TraceRunner {
    private readonly rootSharedDir: string = "/tmp/spp-usercode";
    private readonly userCodeFilePrefix: string = process.env.USER_CODE_FILE_PREFIX || "main";
    private readonly userCodeImageName: string = "spp-user-code-image";
    private readonly userCodeNetworkName: string = "spp-no-internet";

    constructor() {
        if (!fs.existsSync(this.rootSharedDir)) {
            fs.mkdirSync(this.rootSharedDir, { recursive: true });
        }
    }

    async run(code: string, uniqueId: string): Promise<RunnerResult> {
        const files = this.createFilePaths(uniqueId);
        
        // Write files
        fs.writeFileSync(files.userCode.accessible, code);
        fs.writeFileSync(files.trace.accessible, "");
        fs.writeFileSync(files.ccStdout.accessible, "");
        fs.writeFileSync(files.ccStderr.accessible, "");
        fs.writeFileSync(files.stdout.accessible, "");
        fs.writeFileSync(files.stderr.accessible, "");
        fs.writeFileSync(files.sppStdout.accessible, "");

        try {
            // Run container
            const dockerCmd = [
                "docker run",
                "--rm",
                `--network ${this.userCodeNetworkName}`,
                `-v ${files.userCode.accessible}:${files.userCode.isolated}`,
                `-v ${files.trace.accessible}:${files.trace.isolated}`,
                `-v ${files.ccStdout.accessible}:${files.ccStdout.isolated}`,
                `-v ${files.ccStderr.accessible}:${files.ccStderr.isolated}`,
                `-v ${files.stdout.accessible}:${files.stdout.isolated}`,
                `-v ${files.stderr.accessible}:${files.stderr.isolated}`,
                `-v ${files.sppStdout.accessible}:/spp_stdout.txt`,
                this.userCodeImageName
            ].join(" ");
            
            await execPromise(dockerCmd);
            
            // Read results
            const ccStdout = fs.readFileSync(files.ccStdout.accessible, "utf-8");
            const ccStderr = fs.readFileSync(files.ccStderr.accessible, "utf-8");
            
            let stdout = "";
            let stderr = "";
            let traceContent = "";
            
            const hasCompilerError = ccStderr.trim().length > 0;
            if (!hasCompilerError) {
                traceContent = fs.readFileSync(files.trace.accessible, "utf-8");
                stdout = fs.readFileSync(files.stdout.accessible, "utf-8");
                stderr = fs.readFileSync(files.stderr.accessible, "utf-8");
            }
            
            return {
                ccStdout,
                ccStderr,
                stdout,
                stderr,
                traceContent
            };
        } finally {
            // Cleanup
            this.cleanupFiles(files);
        }
    }

    private createFilePaths(uniqueId: string) {
        const makePath = (suffix: string) => ({
            accessible: path.join(this.rootSharedDir, `${uniqueId}${suffix}`),
            isolated: `/${this.userCodeFilePrefix}${suffix}`
        });

        return {
            userCode: makePath(".cpp"),
            trace: makePath("_vgtrace.txt"),
            ccStdout: makePath("_cc_out.txt"),
            ccStderr: makePath("_cc_err.txt"),
            stdout: makePath("_out.txt"),
            stderr: makePath("_err.txt"),
            sppStdout: {
                accessible: path.join(this.rootSharedDir, `${uniqueId}_spp_stdout.txt`),
                isolated: "/spp_stdout.txt"
            }
        };
    }

    private cleanupFiles(files: any) {
        // Optional: implement cleanup if needed
        // Currently matching the commented-out behavior in original code
    }
}