import TraceStep from "./TraceStep";
import Utils from "../utils/Utils";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
    this.traceIndex = 0;
    this.prevVisualizedIndex = 0;
    if (this.trace) {
      this._setupOrphanedMemory();
      this._setupPointerTargets();
    }
  }

  //////////// Mutator Methods ////////////

  stepNext() {
    if (this.encounteredException()) return;
    this.prevVisualizedIndex = this.traceIndex;
    if (!this.atEnd()) this.traceIndex++;
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
    if (this.encounteredException()) return;
    this.prevVisualizedIndex = this.traceIndex;
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

  _setupOrphanedMemory() {
    for (let i = 1; i < this.trace.length; i++ ){
      const prevStep = this.trace[i - 1];
      const currentStep = this.trace[i];
      prevStep.getHeapVariables().forEach(heapVar => {
        if (heapVar.isOrphaned()) currentStep.addHeapVariable(heapVar);
      });
      Object.entries(prevStep.heap).forEach(([address, prevHeapVar]) => {
        if (prevHeapVar.isFree() || address in currentStep.heap) return;
        currentStep.addHeapVariable(prevHeapVar.createOrphan());
      })
    }
  }

  _setupPointerTargets() {
    this.trace.forEach(traceStep => {
      const variables = traceStep.getAllVariables();
      variables.forEach(variable => {
        if (!variable.isPointer()) return;
        for (const otherVar of variables) {
          if (otherVar.address === variable.getValue()) {
            variable.setTarget(otherVar);
            break;
          }
        }
      });
    });
  }
}
