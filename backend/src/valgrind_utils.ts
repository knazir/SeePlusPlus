//------------------------------------------------------------------------------
import { parseValgrindTrace, ProgramTrace } from "./parse_vg_trace";

// Types
//------------------------------------------------------------------------------
interface UncaughtExceptionTrace {
    code: string;
    trace: Array<{
        event: "uncaughtException";
        exceptionMsg: string;
        line?: number;
    }>;
}

export type ValgrindTrace = ProgramTrace | UncaughtExceptionTrace;

//------------------------------------------------------------------------------
export function preprocessCode(userCode: string): string {
    return `#define union struct\n${userCode}`;
}

//------------------------------------------------------------------------------
export function buildValgrindResponse(
    originalUserCode: string,
    preprocessedUserCode: string,
    stdout: string,
    stderr: string
): ValgrindTrace {
    if (stderr.includes("error:") ||
        stderr.includes("#error") ||
        stderr.includes("undefined reference")) {
        return handleGccError("usercode.cpp", originalUserCode, stderr);
    }

    return parseValgrindTrace(stdout, originalUserCode);
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

    return {
        code: userCode,
        trace: [
            {
                event: "uncaughtException",
                exceptionMsg: exceptionMsg,
                line: lineNum
            }
        ]
    };
}
