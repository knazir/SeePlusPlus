import TraceStep from "./TraceStep";
import Utils from "../utils/Utils";
import VisualizationTool from "../utils/VisualizationTool";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
    this.traceIndex = 0;
    this.prevVisualizedIndex = 0;
    if (this.trace) this._calculateOrphanedMemory();
  }

  //////////// Mutator Methods ////////////

  stepNext() {
    this.prevVisualizedIndex = this.traceIndex;
    VisualizationTool.resetViewedFrames();
    if (!this.atEnd()) this.traceIndex++;
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

  //////////// Getters ////////////

  getPreviouslyVisualizedStep() {
    return this.trace[this.prevVisualizedIndex] || null;
  }

  getCurrentStep() {
    return this.trace[this.traceIndex] || null;
  }

  getOutput() {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return "";
    return this.encounteredException() ? currentStep.exceptionMessage : currentStep.stdout;
  }

  encounteredException() {
    return this.getCurrentStep() && this.getCurrentStep().encounteredException();
  }

  //////////// Property Querying ////////////

  atStart() {
    return this.traceIndex === 0;
  }

  atEnd() {
    return this.traceIndex === this.trace.length - 1;
  }

  //////////// Helper Methods ////////////

  _calculateOrphanedMemory() {
    for (let i = 1; i < this.trace.length; i++) {
      for (const orphan in this.trace[i - 1].orphanedMemory) {
        this.trace[i].orphanedMemory.push(this.trace[i - 1].orphanedMemory[orphan]);
      }
      const currHeapVars = this.trace[i].heap;
      const prevHeapVars = this.trace[i - 1].heap;
      Object.entries(prevHeapVars).forEach(([address, prevHeapVar]) => {
        if (prevHeapVar.isFree() || (address in currHeapVars)) return;
        this.trace[i].orphanedMemory.push(prevHeapVar);
      });
    }
  }
}
