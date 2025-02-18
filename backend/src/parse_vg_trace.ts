
// Constants
//------------------------------------------------------------------------------
const RECORD_SEPARATOR: string = "=== pg_trace_inst ===";
const MAX_STEPS: number = 1000;
const ONLY_ONE_REC_PER_LINE: boolean = true;

// Data Structures
//------------------------------------------------------------------------------
interface ExecutionPoint {
    event: string;
    line: number;
    funcName: string;
    stackToRender: Array<any>;
    globals: any;
    orderedGlobals: string[];
    stdout: string;
    exceptionMsg?: string;
    toDelete?: boolean; // for intermediate filtering
}

export interface ProgramTrace {
    code: string,
    trace: ExecutionPoint[]
} 

//------------------------------------------------------------------------------
export function parseValgrindTrace(
    rawValgrindOutput: string,
    userCode: string,
    endOfTraceErrorMessage?: string
): ProgramTrace {
    console.log(`Parsing Valgrind trace for ${userCode.length} chars`);
    // console.log("Raw Valgrind output:", rawValgrindOutput);

    // Clear global array for each fresh parse
    const allExecutionPoints: ExecutionPoint[] = [];

    // Split entire valgrind output into lines
    const lines = rawValgrindOutput.split("\n");

    // We'll collect lines of each "record" until we hit the RECORD_SEP
    let currentRecordLines: string[] = [];
    let parseOk = true;

    // Skip lines until the first RECORD_SEPARATOR to skip output
    let startIndex: number = 0;
    for (startIndex = 0; startIndex < lines.length; startIndex++) {
        if (lines[startIndex].trim() == RECORD_SEPARATOR) {
            break;
        }
    }
    
    for (let i = startIndex + 1; i < lines.length; i++) {
        const line: string = lines[i];

        if (line.trim() == RECORD_SEPARATOR) {
            if (!processRecord(allExecutionPoints, currentRecordLines)) {
                parseOk = false;
                break;
            }
            currentRecordLines = [];
        } else {
            currentRecordLines.push(line);
        }
    }

    // Process the last record if any remain
    if (parseOk && currentRecordLines.length > 0) {
        parseOk = processRecord(allExecutionPoints, currentRecordLines);
    }

    let finalTrace: ExecutionPoint[] = [];
    if (parseOk) {
        finalTrace = finalizeTrace(allExecutionPoints, endOfTraceErrorMessage);
    }

    return {
        code: userCode,
        trace: finalTrace
    };
}

// Takes the lines for one record and extracts:
//  - A JSON block (with stack info)
//  - "ERROR: ..." lines (only the first is used)
//  - "STDOUT: ..." line
// and merges them into one ExecutionPoint
//------------------------------------------------------------------------------
function processRecord(allExecutionPoints: ExecutionPoint[], lines: string[]): boolean {
    if (!lines || lines.length === 0) {
        return true;
    }

    const errLines: string[] = [];
    const stdoutLines: string[] = [];
    const regularLines: string[] = [];

    for (const line of lines) {
        if (line.startsWith("ERROR:")) {
            errLines.push(line);
        } else if (line.startsWith("STDOUT:")) {
            stdoutLines.push(line);
        } else if (line.startsWith("MAX_STEPS_EXCEEDED")) {
            // do nothing
        } else {
            regularLines.push(line);
        }
    }

    const stdoutLine: string = stdoutLines[0] || 'STDOUT: ""';
    let stdoutStr: string = "";
    try {
        stdoutStr = JSON.parse(stdoutLine.slice("STDOUT: ".length));
    } catch {
        // Fallback if JSON parse fails
        stdoutStr = "";
    }

    // Combine the rest of the regular lines into one JSON string
    let recordJSON: string = regularLines.join("\n");
    
    // Replace "val":****** with "val":null
    recordJSON = recordJSON.replace(/"val":\*{6,}/g, '"val":null');

    let obj: any;
    try {
        obj = JSON.parse(recordJSON);
    } catch {
        // Could not parse
        return false;
    }

    // Take the first error line if present
    const errStr: string | null = errLines.length > 0 ? errLines[0] : null;

    // Convert the raw object into an ExecutionPoint
    const executionPoint = processJsonObject(obj, errStr, stdoutStr);
    allExecutionPoints.push(executionPoint);

    // If we have an exception event, stop further parsing
    if (executionPoint.event === "exception") {
        return false;
    }

    return true;
}

// - Remove frames with 0x0 FP or ??? function
// - Remove duplicates, identify call/return, skip pre-main, etc.
//------------------------------------------------------------------------------
function finalizeTrace(
    allExecutionPoints: ExecutionPoint[],
    endOfTraceErrorMessage?: string
): ExecutionPoint[] {
    // 1. Filter out points with 0x0 frame pointer or ??? funcName
    const filtered: ExecutionPoint[] = [];
    for (const ep of allExecutionPoints) {
        const frameIds = ep.stackToRender.map(f => f.frameId);
        const funcNames = ep.stackToRender.map(f => f.funcName);
        if (frameIds.includes("0x0") || funcNames.includes("???")) {
            continue;
        }
        filtered.push(ep);
    }
    if (filtered.length === 0) {
        return [];
    }

    // 2. Build final array, ensuring stack transitions are call/return if they differ
    //    by +/- 1
    const finalPoints: ExecutionPoint[] = [filtered[0]];

    for (let i = 0; i < filtered.length - 1; i++) {
        const prev = filtered[i];
        const cur = filtered[i + 1];

        const prevFrameIds = prev.stackToRender.map(f => f.frameId);
        const curFrameIds = cur.stackToRender.map(f => f.frameid);

        if (JSON.stringify(prevFrameIds) === JSON.stringify(curFrameIds)) {
            // Idental stack => push
            finalPoints.push(cur);
        } else if (curFrameIds.length === prevFrameIds.length + 1) {
            // Possible function call
            const slicePrev = curFrameIds.slice(0, -1);
            if (JSON.stringify(slicePrev) === JSON.stringify(prevFrameIds)) {
                cur.event = "call";
                finalPoints.push(cur);

                // Lookahead optimization
                const curLine = cur.line;
                for (let j = i + 2; j < filtered.length; j++) {
                    const future = filtered[j];
                    const futureFrameIds = future.stackToRender.map(f => f.frameId);

                    if (
                        JSON.stringify(futureFrameIds) === JSON.stringify(curFrameIds) &&
                        future.line === curLine
                    ) {
                        future.toDelete = true;
                    } else {
                        break;
                    }
                }
            } else {
                finalPoints.push(cur);
            }
        } else if (curFrameIds.length === prevFrameIds.length - 1) {
            // Possible return
            const sliceCur = prevFrameIds.slice(0, -1);
            if (JSON.stringify(sliceCur) === JSON.stringify(curFrameIds)) {
                prev.event = "return";
            }
            finalPoints.push(cur);
        } else {
            // Weird mismatch
            finalPoints.push(cur);
        }
    }

    // 3. Mark the last step as a return or exception
    if (finalPoints.length > 0) {
        if (endOfTraceErrorMessage) {
            finalPoints[finalPoints.length - 1].event = "exception";
            finalPoints[finalPoints.length - 1].exceptionMsg = endOfTraceErrorMessage;
        } else {
            // Default to "return" from main
            finalPoints[finalPoints.length - 1].event = "return";
        }
    }

    // 4. Remove repeated stepLine on the same line if ONLY_ONE_REC_PER_LINE
    if (ONLY_ONE_REC_PER_LINE) {
        const reduced: ExecutionPoint[] = [];
        let prevEvent = "";
        let prevLine = 0;
        let prevFrames = "";

        for (const ep of finalPoints) {
            const curEvent = ep.event;
            const curLine = ep.line;
            const curFrames = JSON.stringify(ep.stackToRender.map(f => f.frameId));
            let skip = false;

            if (prevEvent === curEvent && curEvent == "stepLine" &&
                curLine === prevLine && curFrames === prevFrames) {
                    skip = true;
            }
            if (!skip) {
                reduced.push(ep);
                prevEvent = curEvent;
                prevLine = curLine;
                prevFrames = curFrames;
            }
        }
        finalPoints.splice(0, finalPoints.length, ...reduced);
    }

    // 5. Skip extraneous step after a return to the same line in the caller
    for (let i = 0; i < finalPoints.length - 2; i++) {
        const prev = finalPoints[i];
        const cur = finalPoints[i + 1];
        const nxt = finalPoints[i + 2];
    
        if (prev.event === "return" && prev.stackToRender.length > 1) {
          const prevCaller = prev.stackToRender[prev.stackToRender.length - 2];
          const curTop = cur.stackToRender[cur.stackToRender.length - 1];
          if (curTop &&
              prevCaller &&
              curTop.frame_id === prevCaller.frame_id &&
              curTop.line === prevCaller.line &&
              cur.funcName === nxt.funcName) {
              cur.toDelete = true;
          }
        }
    }

    // 6. Skip everything before main
    let foundMain = false;
    for (const pt of finalPoints) {
      if (pt.funcName === "main") {
        foundMain = true;
        break;
      } else {
        pt.toDelete = true;
      }
    }
    let finalFiltered = finalPoints.filter(p => !p.toDelete);

    // 7. Truncate to MAX_STEPS
    if (finalFiltered.length > MAX_STEPS) {
        finalFiltered = finalFiltered.slice(0, MAX_STEPS);
        const last = finalFiltered[finalFiltered.length - 1];
        last.event = "instruction_limit_reached";
        last.exceptionMsg = `Stopped after ${MAX_STEPS} steps. Please shorten your code.`;
    }

    return finalFiltered;
}

// - Reverses the stack
// - Pulls top stack info for line, function name
// - Encodes "globals" and "stack_to_render" in the OPT C format
//------------------------------------------------------------------------------
function processJsonObject(
    obj: any,
    errStr: string | null,
    stdoutStr: string
): ExecutionPoint {
    if (!obj.stack || obj.stack.length < 1) {
        console.warn(`Record has no stack frames: ${JSON.stringify(obj)}`);
    }

    // Reverse the stack so the "top" is at the end
    if (Array.isArray(obj.stack)) {
        obj.stack.reverse();
    }

    const topStackEntry = obj.stack && obj.stack[obj.stack.length - 1];

    const executionPoint: ExecutionPoint = {
        event: "stepLine",
        line: obj.line,
        funcName: topStackEntry?.func_name || "???",
        stackToRender: [],
        globals: {},
        orderedGlobals: obj.ordered_globals || [],
        stdout: stdoutStr
    };

    if (errStr) {
        executionPoint.event = "exception";
        executionPoint.exceptionMsg = `${errStr}\n(Stopped after the first error.)`;
    }

    // Encode globals
    if (obj.globals) {
        for (const [gVar, gVal] of Object.entries(obj.globals)) {
            executionPoint.globals[gVar] = encodeValue(gVal, {} /*dummy heap for now */);
        }
    }

    // Build stack_to_render
    if (obj.stack) {
        for (const frameObj of obj.stack) {
            const stackEntry: any = {
                funcName: frameObj.func_name,
                orderedVarNames: frameObj.ordered_varnames || [],
                isHighlighted: frameObj === topStackEntry,
                frameId: frameObj.FP,
                uniqueHash: `${frameObj.func_name}_${frameObj.FP}`,
                isParent: false,
                isZombie: false,
                parentFrameIdList: [],
                encodedLocals: {}
            };
            if (frameObj.line) {
                stackEntry.line = frameObj.line;
            }
            if (frameObj.locals) {
                for (const [localVar, localVal] of Object.entries(frameObj.locals)) {
                    stackEntry.encodedLocals[localVar] = encodeValue(localVal, {});
                }
            }
            executionPoint.stackToRender.push(stackEntry);
        }
    }

    return executionPoint;
}

// Transform raw Valgrind JSON into OPT C_DATA, C_STRUCT format
//------------------------------------------------------------------------------
function encodeValue(obj: any, heap: Record<string, any>): any {
    if (!obj || !obj.kind) {
        return null;
    }

    switch (obj.kind) {
        case "base": {
            return ["C_DATA", obj.addr, obj.type, obj.val];
        }
        case "pointer":
        case "ref": {
            if (obj.deref_val) {
                encodeValue(obj.deref_val, heap);
            }
            return ["C_DATA", obj.addr, obj.kind, obj.val];
        }
        case "struct": {
            const structData: any[] = ["C_STRUCT", obj.addr, obj.type];
            const members = Object.entries(obj.val || {}) as Array<[string, any]>;

            // Sort members by address
            members.sort(([, aVal], [, bVal]) => {
                return (aVal.addr || "").localeCompare(bVal.addr || "");
            });
            for (const [k, v] of members) {
                structData.push([k, encodeValue(v, heap)]);
            }
            return structData;
        }
        case "array": {
            if (!obj.dimensions || obj.dimensions.length < 2) {
                // Single-dimension
                const arrayData: any[] = ["C_ARRAY", obj.addr];
                for (const e of obj.val || []) {
                    arrayData.push(encodeValue(e, heap));
                }
                return arrayData;
            } else {
                // Multi-dimension
                const arrayData: any[] = ["C_MULTIDIMENSIONAL_ARRAY", obj.addr, obj.dimensions];
                for (const e of obj.val || []) {
                    arrayData.push(encodeValue(e, heap));
                }
                return arrayData;
            }
        }
        case "typedef": {
            if (obj.val) {
                obj.val.type = obj.type;
                return encodeValue(obj.val, heap);
            }
            return null;
        }
        case "heap_block": {
            // Store in "heap" if you want to reference it later
            if (!heap[obj.addr]) {
                const newElt: any[] = ["C_ARRAY", obj.addr];
                for (const e of obj.val || []) {
                    newElt.push(encodeValue(e, heap));
                }
                heap[obj.addr] = new Element;
            }
            return null;
        }
        default: {
            console.warn(`encodeValue: unknown kind ${obj.kind}`);
            return null;
        }
    }
}
