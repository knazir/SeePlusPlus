import TraceStep from "./TraceStep";
import Utils from "../utils/Utils";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
    this.traceIndex = 0;
    if (this.trace) {
      this._setupOrphanedMemory();
      this._setupPointerTargets();
      this._setupActiveStackFrames();
    }
  }

  //////////// Mutator Methods ////////////

  stepNext() {
    if (this.encounteredException() || this.atEnd()) return false;
    this.traceIndex++;
    return true;
  }

  stepPrev() {
    if (this.atStart()) return false;
    this.traceIndex--;
    return true;
  }

  stepStart() {
    if (this.atStart()) return false;
    this.traceIndex = 0;
    return true;
  }

  stepEnd() {
    if (this.encounteredException() || this.atEnd()) return false;
    this.traceIndex = this.trace.length - 1;
    return true;
  }

  //////////// Getters ////////////

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

  //////////// Mutator Methods ////////////

  setStackFrameExpanded(stackFrame, expanded) {
    this.trace.forEach(traceStep => {
      if (!traceStep.stack) return;
      const targetFrame = traceStep.stack.filter(frame => frame.getId() === stackFrame.getId())[0];
      if (targetFrame) targetFrame.setExpanded(expanded);
    });
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
      if (traceStep.encounteredException()) return;
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

  _setupActiveStackFrames() {
    this.trace.forEach(traceStep => {
      if (!traceStep.encounteredException()) traceStep.stack[traceStep.stack.length - 1].setActive(true);
    });
  }
}
