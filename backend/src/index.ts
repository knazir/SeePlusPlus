//------------------------------------------------------------------------------
import { exec } from "child_process";
import crypto from "crypto";
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import util from "util";

import {
    buildValgrindResponse,
    preprocessCode,
    ValgrindTrace
} from "./valgrind_utils";

// Types
//------------------------------------------------------------------------------
interface MappedFilePath {
    accessible: string;
    isolated: string;
}

// Setup
//------------------------------------------------------------------------------
dotenv.config();
const app: Express = express();
const execPromise = util.promisify(exec);

const PORT: number = Number(process.env.PORT) || 3000;
const ROOT_SHARED_DIR: string = "/tmp/spp-usercode";
const USER_CODE_FILE_PREFIX = process.env.USER_CODE_FILE_PREFIX || "main";
const USER_CODE_IMAGE_NAME: string = "spp-user-code-image";
const USER_CODE_NETWORK_NAME: string = "spp-no-internet";

if (!fs.existsSync(ROOT_SHARED_DIR)) {
    fs.mkdirSync(ROOT_SHARED_DIR, { recursive: true });
}

// Middleware
//------------------------------------------------------------------------------
app.use(express.json());

// Route: /
// Returns a healthcheck to confirm the server is running
//------------------------------------------------------------------------------
app.get("/", (req: Request, res: Response) => {
  res.send("See++ backend online");
});

// Route: /run
// Parameters (Body): { code: string }
// Spins up a docker container to compile and run the provided C++ code under
// Valgrind and return a trace.
//------------------------------------------------------------------------------
app.post("/run", async (req: Request, res: Response) => {
    const userCode: string | undefined = req.body.code;
    let preprocessedUserCode: string | undefined = userCode;
    if (userCode) {
        preprocessedUserCode = preprocessCode(userCode);
    } else {
        res.status(400).json({ error: "Code is required" });
        return;
    }

    // Generate a unique filename using a hash
    // These are temporary files that the container parent can share to spawned siblings
    // so must be delimited by the uniqueId. They will be replaced with well-known names
    // within the user's individual container.
    const uniqueId: crypto.UUID = crypto.randomUUID();
    const userCodeFilePath: MappedFilePath = makeMappedFilePath(uniqueId, ".cpp");
    const traceFilePath: MappedFilePath = makeMappedFilePath(uniqueId, "_vgtrace.txt");
    const ccStdoutFilePath: MappedFilePath = makeMappedFilePath(uniqueId, "_cc_out.txt");
    const ccStderrFilePath: MappedFilePath = makeMappedFilePath(uniqueId, "_cc_err.txt");
    const stdoutFilePath: MappedFilePath = makeMappedFilePath(uniqueId, "_out.txt");
    const stderrFilePath: MappedFilePath = makeMappedFilePath(uniqueId, "_err.txt");

    try {
        // Write the code into the file's original location to make it available when
        // mapped into the user code container. Create the other files too to avoid
        // Docker creating empty directories when mounting.
        fs.writeFileSync(userCodeFilePath.accessible, preprocessedUserCode);
        fs.writeFileSync(traceFilePath.accessible, "");
        fs.writeFileSync(ccStdoutFilePath.accessible, "");
        fs.writeFileSync(ccStderrFilePath.accessible, "");
        fs.writeFileSync(stdoutFilePath.accessible, "");
        fs.writeFileSync(stderrFilePath.accessible, "");
        fs.writeFileSync(`/tmp/spp-usercode/${uniqueId}_spp_stdout.txt`, "");
        
        // Isolate the user's code in a container with no network access and only mount
        // the specific files needed to avoid leakagae of other users' code.
        const dockerCmd = [
            "docker run",
            // "--rm",
            `--network ${USER_CODE_NETWORK_NAME}`,
            `-v ${userCodeFilePath.accessible}:${userCodeFilePath.isolated}`,
            `-v ${traceFilePath.accessible}:${traceFilePath.isolated}`,
            `-v ${ccStdoutFilePath.accessible}:${ccStdoutFilePath.isolated}`,
            `-v ${ccStderrFilePath.accessible}:${ccStderrFilePath.isolated}`,
            `-v ${stdoutFilePath.accessible}:${stdoutFilePath.isolated}`,
            `-v ${stderrFilePath.accessible}:${stderrFilePath.isolated}`,
            `-v /tmp/spp-usercode/${uniqueId}_spp_stdout.txt:/spp_stdout.txt`,
            USER_CODE_IMAGE_NAME
        ].join(" ");
        await execPromise(dockerCmd);
        
        // Should always have compiler output
        let ccStdout: string = "";
        let ccStderr: string = "";
        if (fs.existsSync(ccStdoutFilePath.accessible)) {
            console.log(ccStdoutFilePath.accessible);
            ccStdout = fs.readFileSync(ccStdoutFilePath.accessible, "utf-8");
        }
        if (fs.existsSync(ccStderrFilePath.accessible)) {
            console.log(ccStdoutFilePath.accessible);
            ccStderr = fs.readFileSync(ccStderrFilePath.accessible, "utf-8");
        }

        // May or may not have user code output based on if compilation failed
        let vgTrace: string = "";
        let stdout: string = "";
        let stderr: string = "";
        const hasCompilerError: boolean = ccStderr.trim().length > 0;
        if (!hasCompilerError) {
            vgTrace = fs.readFileSync(traceFilePath.accessible, "utf-8");
            stdout = fs.readFileSync(stdoutFilePath.accessible, "utf-8");
            stderr = fs.readFileSync(stderrFilePath.accessible, "utf-8");
        }

        // Cleanup
        // fs.rmSync(userCodeFilePath.accessible);
        // fs.rmSync(traceFilePath.accessible);
        // fs.rmSync(ccStdoutFilePath.accessible);
        // fs.rmSync(ccStderrFilePath.accessible);
        // fs.rmSync(stdoutFilePath.accessible);
        // fs.rmSync(stderrFilePath.accessible);

        const trace: ValgrindTrace = buildValgrindResponse(
            `${USER_CODE_FILE_PREFIX}.cpp`,
            userCode,
            preprocessedUserCode,
            ccStdout,
            ccStderr,
            stdout,
            stderr,
            vgTrace
        );

        res.json(trace);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

//------------------------------------------------------------------------------
function makeMappedFilePath(uniqueId: string, suffix: string): MappedFilePath {
    const original = path.join(ROOT_SHARED_DIR, `${uniqueId}${suffix}`);
    const mapped = `/${USER_CODE_FILE_PREFIX}${suffix}`;
    return { accessible: original, isolated: mapped };
}

// Start server
//------------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[Server]: See++ backend is running at http://localhost:${PORT}`);
});
