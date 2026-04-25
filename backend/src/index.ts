//------------------------------------------------------------------------------
import cors from "cors";
import crypto from "crypto";
import express, { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { closeDb, getPool, initDb } from "./db";
import { registerProviders } from "./auth/providers";
import { buildSessionMiddleware } from "./auth/session";
import { loadFlags } from "./flags";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { flagsRouter } from "./routes/flags";
import {
    createRunner,
    TraceRunner
} from "./runners";
import { workspacesRouter } from "./routes/workspaces";
import {
    buildValgrindResponse,
    preprocessCode,
    ValgrindTrace
} from "./valgrind_utils";

// Setup
//------------------------------------------------------------------------------
const app: Express = express();
const runner: TraceRunner = createRunner();

const PORT: number = Number(process.env.PORT) || 3000;
const USER_CODE_FILE_PREFIX = process.env.USER_CODE_FILE_PREFIX || "main";

// Middleware
//------------------------------------------------------------------------------
// The backend sits behind nginx (frontend container) and an ALB in deployed
// envs; trusting the proxy lets express-session's `secure` cookie decision
// honor X-Forwarded-Proto.
app.set("trust proxy", 1);

app.use(helmet());

// 128KB cap on JSON bodies. /api/run takes user code; everything else is
// small JSON.
app.use(express.json({ limit: "128kb" }));

const ALLOWED_ORIGIN_REGEX_RAW = process.env.ALLOWED_ORIGIN_REGEX;
const ALLOWED_ORIGIN_REGEX = ALLOWED_ORIGIN_REGEX_RAW
    ? new RegExp(ALLOWED_ORIGIN_REGEX_RAW)
    : null;
// Allow localhost in dev when no ALLOWED_ORIGIN_REGEX is configured;
// reflecting arbitrary origins with credentials:true would be unsafe.
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            // Same-origin / curl / server-to-server — let through.
            callback(null, true);
            return;
        }
        if (ALLOWED_ORIGIN_REGEX && ALLOWED_ORIGIN_REGEX.test(origin)) {
            callback(null, true);
            return;
        }
        if (process.env.NODE_ENV === "development" && LOCALHOST_RE.test(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS error: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

// /api/run is the only unauthenticated endpoint that consumes real
// compute (Docker / Lambda); rate-limit it. Other write paths have
// limiters inside their own routers.
const runRateLimit = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate limit exceeded — try again in a minute" },
});

// Sessions + OAuth providers are registered after initDb() in start() below
// so the pool exists before connect-pg-simple tries to use it.

// Route: /
// Returns a healthcheck to confirm the server is running
//------------------------------------------------------------------------------
app.get("/api", (req: Request, res: Response) => {
    res.send("See++ backend online");
});

// Route: /run
// Parameters (Body): { code: string }
// Spins up a docker container to compile and run the provided C++ code under
// Valgrind and return a trace.
//------------------------------------------------------------------------------
app.post("/api/run", runRateLimit, async (req: Request, res: Response) => {
    const userCode: string | undefined = req.body.code;
    let preprocessedUserCode: string | undefined = userCode;
    if (userCode) {
        preprocessedUserCode = preprocessCode(userCode);
    } else {
        res.status(400).json({ error: "Code is required" });
        return;
    }

    // Generate hash-based ID for caching in deployed environments
    let uniqueId: string;
    if (process.env.NODE_ENV !== "development") {
        // Use SHA-256 hash of the preprocessed code as the unique ID
        const hash = crypto.createHash('sha256');
        hash.update(preprocessedUserCode);
        uniqueId = hash.digest('hex');
    } else {
        // Use random UUID for development to avoid cache collisions during testing
        uniqueId = crypto.randomUUID();
    }

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
async function start(): Promise<void> {
    try {
        await initDb();
    } catch (err) {
        // Don't block startup on DB failure — the runner endpoint still works
        // and /api/workspaces returns 503 until DATABASE_URL is healthy.
        console.error("[Server]: failed to initialize database:", err);
    }

    registerProviders();
    await loadFlags();

    const pool = getPool();
    const sessionMw = pool ? buildSessionMiddleware(pool) : null;
    if (sessionMw) app.use(sessionMw);

    app.use("/api/auth", authRouter);
    app.use("/api/workspaces", workspacesRouter);
    app.use("/api/flags", flagsRouter);
    app.use("/api/admin", adminRouter);

    const server = app.listen(PORT, () => {
        console.log(`[Server]: See++ backend is running at http://localhost:${PORT}`);
    });

    const shutdown = async (signal: string) => {
        console.log(`[Server]: received ${signal}, shutting down`);
        server.close(async () => {
            await closeDb();
            process.exit(0);
        });
    };
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
}

void start();
