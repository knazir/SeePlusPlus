//------------------------------------------------------------------------------
import { parseValgrindTrace, ProgramTrace } from "./parse_vg_trace";

export type ValgrindTrace = ProgramTrace;

//------------------------------------------------------------------------------
export function preprocessCode(userCode: string): string {
    return `#define union struct\n${userCode}`;
}

//------------------------------------------------------------------------------
export function buildValgrindResponse(
    userCodeFileName: string,
    originalUserCode: string,
    preprocessedUserCode: string,
    ccStdout: string,
    ccStderr: string,
    stdout: string,
    stderr: string,
    vgTrace: string
): ValgrindTrace {
    if (ccStderr.includes("error:")     ||
        ccStderr.includes("#error")     ||
        ccStderr.includes("undefined reference")) {
        return handleGccError(userCodeFileName, originalUserCode, ccStderr);
    }

    // Lambda mode: shift stdout by 1 step to compensate for timing offset
    // (stdout appears 1 instruction after the actual cout call due to buffering)
    const shiftStdout = process.env.EXEC_MODE === "lambda" ? 1 : undefined;

    return parseValgrindTrace(vgTrace, originalUserCode, undefined, shiftStdout);
}

//------------------------------------------------------------------------------
function handleGccError(
    fileName: string,
    userCode: string,
    gccOutput: string,
): ValgrindTrace {
    let exceptionMsg = "unknown compiler error";
    let lineNum: number | undefined;

    const lines = gccOutput.split("\n");
    for (const line of lines) {
        // Pattern: usercode.cpp:12:3: error: ...
        const re = new RegExp(`${fileName}:(\\d+):(\\d+):.*?(error:.*$)`);
        const match = re.exec(line);
        if (match) {
          lineNum = parseInt(match[1], 10);
          exceptionMsg = match[3].trim();
          break;
        }

        // Handle custom-defined #error
        if (line.includes("#error")) {
            exceptionMsg = line.split("#error").pop()?.trim() || exceptionMsg;
            break;
        }

        // Linker errors (e.g. "undefined reference")
        if (line.includes("undefined ")) {
            const parts = line.split(":");
            exceptionMsg = parts[parts.length - 1].trim();
            // see if there's a line number
            if (parts[0].includes(fileName)) {
                const maybeLine = parseInt(parts[1], 10);
                if (!isNaN(maybeLine)) {
                    lineNum = maybeLine;
                }
            }
            break;
        }
    }

    // Emit a full ExecutionPoint shape so the frontend's Zod validator
    // accepts this as a regular ProgramTrace. The one-liner exceptionMsg
    // surfaces in the build-failed banner; the raw gcc output is piped
    // to the bottom console via `buildOutput`.
    return {
        code: userCode,
        buildOutput: gccOutput.trim(),
        trace: [
            {
                event: "uncaughtException",
                exceptionMsg,
                line: lineNum ?? 0,
                funcName: "",
                stackToRender: [],
                globals: {},
                heap: {},
                orderedGlobals: [],
                stdout: "",
            },
        ],
    };
}
