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
    while (!this.isDone()) {
      this.traceIndex++;
      if (this.getCurrentStep().line !== this.trace[this.traceIndex - 1].line) {
        break;
      }
    }
  }

  stepPrev() {
    while (!this.atStart()) {
      this.traceIndex--;
      if (this.getCurrentStep().line !== this.trace[this.traceIndex + 1].line) {
        break;
      }
    }
  }

  stepStart() {
    this.traceIndex = 0;
  }

  stepEnd() {
    this.traceIndex = this.trace.length - 1;
  }

  getCurrentStep() {
    return this.trace[this.traceIndex] || null;
  }
}
