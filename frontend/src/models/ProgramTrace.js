import TraceStep from "./TraceStep";
import Utils from "../utils/Utils";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
    this.traceIndex = 0;
    this.prevVisualizedIndex = 0;
  }

  atStart() {
    return this.traceIndex === 0;
  }

  isDone() {
    return this.traceIndex === this.trace.length - 1;
  }

  stepNext() {
      this.prevVisualizedIndex = this.traceIndex;
      if (!this.isDone()) this.traceIndex++;
  }

  stepPrev() {
      this.prevVisualizedIndex = this.traceIndex;
      if (!this.atStart()) this.traceIndex--;
  }

  stepStart() {
      this.prevVisualizedIndex = this.traceIndex;
      this.traceIndex = 0;
  }

  stepEnd() {
    this.prevVisualizedIndex = this.traceIndex;
    this.traceIndex = this.trace.length - 1;
  }

  getPreviouslyVisualizedStep() {
    return this.trace[this.prevVisualizedIndex] || null;
  }

  getCurrentStep() {
    return this.trace[this.traceIndex] || null;
  }

  encounteredException() {
    return this.getCurrentStep() && this.getCurrentStep().encounteredException();
  }
}
