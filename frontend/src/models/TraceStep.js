import Variable from "./Variable";
import StackFrame from "./StackFrame";
import Utils from "../utils/Utils";

export default class TraceStep {
  constructor({ event, exception_msg, func_name, line, globals, ordered_globals, heap, stack_to_render, stdout }) {
    this.event = event;

    if (this.encounteredException()) {
      this.exceptionMessage = exception_msg;
      return;
    }

    this.funcName = func_name;
    this.line = line - 1; // IMPORTANT: we do line - 1 to discount the #define for fixing unions TODO kn: Do on backend
    this.orderedGlobals = ordered_globals;
    this.heap = this._mapHeap(heap);
    this.globals = this._mapGlobals(globals);
    this.stack = Utils.arrayOfType(StackFrame, stack_to_render, frameData => new StackFrame(frameData, this.heap));
    this.stdout = stdout;
    this.orphanedMemory = [];
  }

  //////////// Getters ////////////

  getCurrentStackFrame() {
    return this.stack[this.stack.length - 1];
  }

  getGlobalVariables() {
    return this.orderedGlobals.map(varName => this.globals[varName].withName(varName));
  }

  getHeapVariables() {
    return Object.values(this.heap);
  }

  getVariables() {
    return [
      ...this.getGlobalVariables(),
      ...this.getCurrentStackFrame().getLocalVariables(),
      ...this.getHeapVariables()
    ];
  }

  //////////// Property Querying ////////////

  encounteredException() {
    return this.event === "exception" || this.event === "uncaught_exception";
  }

  //////////// Helper Methods ////////////

  _mapHeap(heap) {
    // need to create a "meta heap" to pass in to heap variables without being circular (not sure why though...)
    const metaHeap = Utils.mapValues(Variable, heap);
    const resultingHeap = Utils.mapValues(Variable, heap, varData => new Variable(varData, metaHeap, false));
    Object.entries(resultingHeap).forEach(([key, value]) => value.withName(key));
    return resultingHeap;
  }

  _mapGlobals(globals) {
    return Utils.mapValues(Variable, globals, varData => new Variable(varData, this.heap, true));
  }
}
