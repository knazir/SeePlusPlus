import Utils from "../utils/Utils";
import Variable from "./Variable";

export default class StackFrame {
  constructor({ frame_id, func_name, is_highlighted, is_parent, is_zombie, line, parent_frame_id_list, unique_hash,
                encoded_locals, ordered_varnames }, heap, active = false) {
    this.frameId = frame_id;
    this.funcName = func_name;
    this.line = line;
    this.uniqueHash = unique_hash;
    this.encodedLocals = this._mapLocals(encoded_locals, heap);

    // for visualization
    this.active = active; // whether it is the most recent stack frame
    this.expanded = active; // whether the frame is expanded in the visual

    // currently unused properties
    this.isHighlighted = is_highlighted;
    this.orderedVarnames = ordered_varnames;
    this.isParent = is_parent;
    this.isZombie = is_zombie;
    this.parentFrameIdList = parent_frame_id_list;
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
      for (const stackFrame of localVar.getTargets()) {
        if (!expanded && stackFrame.active) continue; // don't close active frame
        stackFrame.setExpanded(expanded);
      }
    });
  }

  //////////// Helper Methods ////////////

  _mapLocals(encoded_locals, heap) {
    const result = Utils.mapValues(Variable, encoded_locals, varData => new Variable(varData, this, false, heap));
    Object.entries(result).forEach(([varName, localVar]) => localVar.setName(varName));
    return result;
  }
}
