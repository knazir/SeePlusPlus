import TraceStep from "./TraceStep";
import Utils from "../utils/Utils";
import VisualizationTool from "../utils/VisualizationTool";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
    this.traceIndex = 0;
    this.prevVisualizedIndex = 0;
    if (this.trace) this.calculateOrphanedMemory();
  }

  atStart() {
    return this.traceIndex === 0;
  }

  isDone() {
    return this.traceIndex === this.trace.length - 1;
  }

  stepNext() {
    this.prevVisualizedIndex = this.traceIndex;
    VisualizationTool.resetViewedFrames();
    if (!this.isDone()) this.traceIndex++;
  }

  stepPrev() {
    this.prevVisualizedIndex = this.traceIndex;
    VisualizationTool.resetViewedFrames();
    if (!this.atStart()) this.traceIndex--;
  }

  stepStart() {
    this.prevVisualizedIndex = this.traceIndex;
    VisualizationTool.resetViewedFrames();
    this.traceIndex = 0;
  }

  stepEnd() {
    this.prevVisualizedIndex = this.traceIndex;
    VisualizationTool.resetViewedFrames();
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

  calculateOrphanedMemory() {
    for (let i = 1; i < this.trace.length; i++) {
      for (let orphan in this.trace[i - 1].orphanedMemory) {
        this.trace[i].orphanedMemory.push(this.trace[i - 1].orphanedMemory[orphan]);
      }
      const currHeapVars = this.trace[i].heap;
      const prevHeapVars = this.trace[i - 1].heap;
      for (let heapAddr in prevHeapVars) {
          if (!prevHeapVars[heapAddr].isFree()) {
              if (!(heapAddr in currHeapVars)) {
                  this.trace[i].orphanedMemory.push(prevHeapVars[heapAddr]);
              }
          }
      }
    }
  }
}
