import TraceStep from "./TraceStep";
import Utils from "../utils/Utils";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
    this.traceIndex = 0;
  }

  atStart() {
    return this.traceIndex === 0;
  }

  isDone() {
    return this.traceIndex === this.trace.length - 1;
  }

  stepNext() {
    if (!this.isDone()) this.traceIndex++;
  }

  stepPrev() {
    if (!this.atStart()) this.traceIndex--;
  }

  getCurrentStep() {
    return this.trace[this.traceIndex] || null;
  }
}
