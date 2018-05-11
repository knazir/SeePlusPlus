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
      //this.getCurrentStep().line === this.trace[0].line ||
      //this.getCurrentStep().line === this.trace[0].line + 1;
  }

  isDone() {
    return this.traceIndex === this.trace.length - 1;
      //this.getCurrentStep().line === this.trace[this.trace.length - 1].line;
  }

  stepNext() {
    if (!this.isDone()) this.traceIndex++;

    // let previousLine = this.getCurrentStep().line;
    // while (!this.isDone()) {
    //   this.traceIndex++;
    //   if (this.getCurrentStep().line !== previousLine && !this.atStart()) {
    //     break;
    //   }
    // }
  }

  stepPrev() {
    if (!this.atStart()) this.traceIndex--;

    // if (this.atStart()) return;
    // this.traceIndex--;
    // while (!this.atStart()) {
    //   if (this.getCurrentStep().line !== this.trace[this.traceIndex - 1].line) {
    //     break;
    //   }
    //   this.traceIndex--;
    // }
    // if (this.getCurrentStep().line === this.trace[0].line + 1) {
    //   this.traceIndex = 0;
    // }
  }

  stepStart() {
    this.traceIndex = 0;
  }

  stepEnd() {
    this.traceIndex = this.trace.length - 1;
    // while (this.getCurrentStep().line === this.trace[this.traceIndex - 1].line) {
    //   this.traceIndex--;
    // }
  }

  getPreviousStep() {
    return this.atStart() ? this.trace[this.traceIndex] : this.trace[this.traceIndex - 1];
  }

  getCurrentStep() {
    return this.trace[this.traceIndex] || null;
  }

  encounteredException() {
    return this.getCurrentStep() &&
      (this.getCurrentStep().event === "uncaught_exception" || this.getCurrentStep() === "exception");
  }
}
