//------------------------------------------------------------------------------
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";

import {
    buildValgrindResponse,
    preprocessCode,
    ValgrindTrace
} from "./valgrind_utils";
import { createRunner, TraceRunner } from "./runners";

// Types
//------------------------------------------------------------------------------

// Setup
//------------------------------------------------------------------------------
dotenv.config();
const app: Express = express();
const runner: TraceRunner = createRunner();

const PORT: number = Number(process.env.PORT) || 3000;
const USER_CODE_FILE_PREFIX = process.env.USER_CODE_FILE_PREFIX || "main";

// Middleware
//------------------------------------------------------------------------------
app.use(express.json());

// Configure CORS to allow requests from the frontend
app.use(cors({
  origin: ["http://localhost:8080", "http://localhost:8000", "http://localhost:3000"],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

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

    const uniqueId: crypto.UUID = crypto.randomUUID();

    try {
        // Use the runner abstraction to execute the code
        const result = await runner.run(preprocessedUserCode, uniqueId);

        const trace: ValgrindTrace = buildValgrindResponse(
            `${USER_CODE_FILE_PREFIX}.cpp`,
            userCode,
            preprocessedUserCode,
            result.ccStdout,
            result.ccStderr,
            result.stdout,
            result.stderr,
            result.traceContent
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
