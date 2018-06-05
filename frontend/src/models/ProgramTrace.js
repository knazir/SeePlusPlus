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
      this._setupChangedStackFrames();
    }
    if (this.trace[this.trace.length - 1].encounteredException() && this.trace.length > 1) {
      this.trace[this.trace.length - 1].loadStep(this.trace[this.trace.length - 2]);
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

  stepLine(lineNumber) {
    for (let i = this.traceIndex + 1; i <= this.traceIndex + this.trace.length; i++) {
      const newIndex = i % this.trace.length;
      if (this.trace[newIndex].line === lineNumber) {
        this.traceIndex = newIndex;
        return true;
      }
    }
    return false;
  }

  //////////// Getters ////////////

  getCurrentStep() {
    return this.trace[this.traceIndex] || null;
  }

  getOutput() {
    const currentStep = this.getCurrentStep();
    if (!currentStep) return "";
    return this.encounteredException() ? currentStep.getExceptionMessage() : currentStep.stdout;
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
      if (currentStep.encounteredException()) continue;
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
        variable.setTargetVariable(variables);
      });
    });
  }

  _setupActiveStackFrames() {
    this.trace.forEach(traceStep => {
      if (!traceStep.encounteredException()) traceStep.stack[traceStep.stack.length - 1].setActive(true);
    });
  }

  _setupChangedStackFrames() {
    for (let i = 1; i < this.trace.length; i++) {
      const traceStep = this.trace[i];
      if (traceStep.encounteredException()) continue;
      for (let j = 0; j < traceStep.stack.length; j++) {
        const stackFrame = traceStep.stack[j];
        if (stackFrame.active || stackFrame.expanded) continue;
        const oldStackFrame = this.trace[i - 1].stack[j];
        if (!oldStackFrame || oldStackFrame.getId() !== stackFrame.getId()) continue;
        const oldLocals = oldStackFrame.getLocalVariables();
        const newLocals = stackFrame.getLocalVariables();
        const localAdded = oldLocals.length !== newLocals.length;
        const localChanged = oldLocals.filter((localVar, index) => !localVar.hasSameValue(newLocals[index])).length > 0;
        const shouldExpand = localAdded || localChanged;
        if (!stackFrame.expanded && shouldExpand) stackFrame.setExpanded(true);
      }
    }
  }
}
