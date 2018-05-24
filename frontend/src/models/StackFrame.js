import Utils from "../utils/Utils";
import Variable from "./Variable";

export default class StackFrame {
  constructor({ frame_id, func_name, is_highlighted, is_parent, is_zombie, line, parent_frame_id_list, unique_hash,
                encoded_locals, ordered_varnames }, heap) {
    this.frameId = frame_id;
    this.funcName = func_name;
    this.line = line;
    this.uniqueHash = unique_hash;
    this.encodedLocals = Utils.mapValues(Variable, encoded_locals, varData => new Variable(varData, this, false, heap));

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

}
