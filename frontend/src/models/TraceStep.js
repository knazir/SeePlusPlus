import Variable from "./Variable";
import StackFrame from "./StackFrame";
import Utils from "../utils/Utils";

export default class TraceStep {
  constructor({ event, exception_msg, func_name, line, globals, ordered_globals, heap, stack_to_render, stdout }) {
    this.event = event;

    if (this.encounteredException()) {
      this.exceptionMessage = exception_msg;
      this.line = line - 1;
      return;
    }

    this.funcName = func_name;
    this.line = line - 1; // IMPORTANT: we do line - 1 to discount the #define for fixing unions TODO kn: Do on backend
    this.heap = this._mapHeap(heap);
    this.globals = this._mapGlobals(globals);
    this.stack = this._createStack(stack_to_render);
    this.stdout = stdout;

    // currently unused properties
    this.orderedGlobals = ordered_globals;
  }

  //////////// Getters ////////////

  getActiveStackFrame() {
    return this.stack[this.stack.length - 1];
  }

  getGlobalVariables() {
    return Object.values(this.globals);
  }

  getHeapVariables() {
    return Object.values(this.heap);
  }

  getAllVariables() {
    return [
      ...this.getHeapVariables(),
      ...this.getGlobalVariables(),
      ...this._getAllStackVariables()
    ];
  }

  getExceptionMessage() {
    if (!this.line) return this.exceptionMessage;
    return `${this.exceptionMessage} at line ${this.line}`;
  }

  //////////// Property Querying ////////////

  encounteredException() {
    return this.event === "exception" || this.event === "uncaught_exception";
  }

  //////////// Mutator Methods ////////////

  addHeapVariable(heapVar) {
    this.heap[heapVar.name] = heapVar;
  }

  //////////// Helper Methods ////////////

  _mapHeap(heap) {
    // need to create a "meta heap" to pass in to heap variables without being circular (not sure why though...)
    // note, no variables should be orphaned here as we check after all heaps are mapped (so we ignore the property)
    const metaHeap = Utils.mapValues(Variable, heap, varData => new Variable(varData, null, false, heap));
    const result = Utils.mapValues(Variable, heap, varData => new Variable(varData, null, false, metaHeap));
    Object.entries(result).forEach(([varName, heapVar]) => heapVar.setName(varName));
    return result;
  }

  _mapGlobals(globals) {
    const result = Utils.mapValues(Variable, globals, varData => new Variable(varData, null, true, this.heap));
    Object.entries(result).forEach(([varName, globalVar]) => globalVar.setName(varName));
    return result;
  }

  _createStack(stack_to_render) {
    return Utils.arrayOfType(StackFrame, stack_to_render, frameData => new StackFrame(frameData, this.heap));
  }

  _getAllStackVariables() {
    if (!this.stack) return [];
    const allLocalVariables = [];
    this.stack.forEach(frame => allLocalVariables.push(...frame.getLocalVariables()));
    return allLocalVariables;
  }
}
