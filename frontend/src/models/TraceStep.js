import Variable from "./Variable";
import StackFrame from "./StackFrame";
import Utils from "../utils/Utils";

export default class TraceStep {
  constructor({ event, exception_msg, func_name, line, globals, ordered_globals, heap, stack_to_render, stdout }) {
    this.event = event;

    if (event === "uncaught_exception") {
      this.exceptionMessage = exception_msg;
      return;
    }

    this.funcName = func_name;
    this.line = line - 1; // IMPORTANT: we do line - 1 to discount the #define for fixing unions
    this.globals = Utils.mapValues(Variable, globals);
    this.orderedGlobals = ordered_globals;
    this.heap = Utils.mapValues(Variable, heap);
    Object.entries(this.heap).forEach(([key, value]) => value.withName(key));
    this.stack = Utils.arrayOfType(StackFrame, stack_to_render, frameData => new StackFrame(frameData, this.heap))
      .reverse(); // place current frame at index 0
    this.stdout = stdout;
  }

  getCurrentStackFrame() {
    return this.stack[0];
  }

  getGlobalVariables() {
    return this.orderedGlobals.map(varName => this.globals[varName].withName(varName));
  }

  getHeapVariables() {
    return Object.values(this.heap);
  }

  getVariables() {
    return [...this.getGlobalVariables(),
      ...this.getCurrentStackFrame().getLocalVariables(),
      ...this.getHeapVariables()];
  }
}
