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

// Setup
//------------------------------------------------------------------------------
dotenv.config();
const app: Express = express();
const execPromise = util.promisify(exec);

const IMAGE_NAME: string = "spp-user-code-image";
const PORT: number = Number(process.env.PORT) || 3000;
const TEMP_DIR: string = "/tmp/spp-usercode";
const USER_CODE_FILE_NAME = "usercode.cpp";

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
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
    const uniqueId: crypto.UUID = crypto.randomUUID();
    const tempFilePath: string = path.join(TEMP_DIR, `${uniqueId}.cpp`);
    const stdoutFilePath = path.join(TEMP_DIR, `${uniqueId}_out.txt`);
    const stderrFilePath = path.join(TEMP_DIR, `${uniqueId}_err.txt`);

    try {
        fs.writeFileSync(tempFilePath, preprocessedUserCode);
        
        const dockerCmd = [
            "docker run",
            "--rm",
            "--network no-internet",
            `-v ${tempFilePath}:/${USER_CODE_FILE_NAME}`,
            IMAGE_NAME,
            `/${USER_CODE_FILE_NAME}`
        ].join(" ");
        await execPromise(`${dockerCmd} > ${stdoutFilePath} 2> ${stderrFilePath}`);
        
        const valgrindStdout: string = fs.readFileSync(stdoutFilePath, "utf-8");
        const valgrindStderr: string = fs.readFileSync(stderrFilePath, "utf-8");
        const valgrindOut: string = [
            '=== Valgrind stdout ===',
            valgrindStdout, 
            '=== Valgrind stderr ===',
            valgrindStderr
        ].join("\n");

        fs.rmSync(tempFilePath);
        fs.rmSync(stdoutFilePath);
        fs.rmSync(stderrFilePath);

        const trace: ValgrindTrace = buildValgrindResponse(
            userCode,
            preprocessedUserCode,
            valgrindStdout,
            valgrindStderr
        );

        res.json(trace);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Start server
//------------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[Server]: See++ backend is running at http://localhost:${PORT}`);
});
