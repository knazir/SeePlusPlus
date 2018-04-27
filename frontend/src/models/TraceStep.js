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
    this.line = line;
    this.globals = Utils.mapValues(Variable, globals);
    this.orderedGlobals = ordered_globals;
    this.heap = Utils.mapValues(Variable, heap);
    this.stack = Utils.arrayOfType(StackFrame, stack_to_render);
    this.stdout = stdout;
  }

  getCurrentStackFrame() {
    return this.stack[this.stack.length - 1];
  }

  getGlobalVariables() {
    return this.orderedGlobals.map(varName => this.globals[varName].withName(varName));
  }

  getVariables() {
    return [...this.getGlobalVariables(), ...this.getCurrentStackFrame().getLocalVariables()];
  }
}
