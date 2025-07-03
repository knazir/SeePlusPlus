import Utils from "../utils/Utils";
import Variable from "./Variable";

export default class StackFrame {
  constructor({ frameId, funcName, isHighlighted, isParent, isZombie, line, parentFrameIdList, uniqueHash,
                encodedLocals, orderedVarNames }, heap, active = false) {
    this.frameId = frameId;
    this.funcName = funcName;
    this.line = line;
    this.uniqueHash = uniqueHash;
    this.encodedLocals = this._mapLocals(encodedLocals, heap);

    // for visualization
    this.active = active; // whether it is the most recent stack frame
    this.expanded = active; // whether the frame is expanded in the visual
    this.stackFrameSources = {}; // which stack frames have variables pointing to this frame's local variables

    // currently unused properties
    this.isHighlighted = isHighlighted;
    this.orderedVarNames = orderedVarNames;
    this.isParent = isParent;
    this.isZombie = isZombie;
    this.parentFrameIdList = parentFrameIdList;
  }

  //////////// Getters ////////////

  getId() {
    return this.uniqueHash;
  }

  getLocalVariables() {
    return Object.values(this.encodedLocals);
  }

  getFuncName() {
    // regex to match function names in C++
    const regex = /:?:?([a-zA-Z1-9_ ~+\-*<>&|=!%^[\]]*)(\(|\[(?!]))/;
    const match = regex.exec(this.funcName);
    return match ? match[1] : this.funcName;
  }

  getStackFrameSources() {
    return Object.values(this.stackFrameSources);
  }

  toString() {
    return `${this.getFuncName()} ${this.frameId ? `(${this.frameId})` : ""}`.trim();
  }

  //////////// Mutator Methods ////////////

  setActive(active) {
    this.active = active;
    this.setExpanded(active);
  }

  setExpanded(expanded) {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.getLocalVariables().forEach(localVar => {
      for (const stackFrame of localVar.getTargetStackFrames()) {
        if (!expanded && stackFrame.active) continue; // don't close active frame
        stackFrame.setExpanded(expanded);
      }
    });
  }

  registerStackFrameSource(stackFrame) {
    this.stackFrameSources[stackFrame.getId()] = stackFrame;
  }

  //////////// Helper Methods ////////////

  _mapLocals(encodedLocals, heap) {
    const result = Utils.mapValues(Variable, encodedLocals, varData => new Variable(varData, this, false, heap));
    Object.entries(result).forEach(([varName, localVar]) => localVar.setName(varName));
    return result;
  }
}
