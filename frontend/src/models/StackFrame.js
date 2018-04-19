import Utils from "../Utils";
import Variable from "./Variable";

export default class StackFrame {
  constructor({ frame_id, func_name, is_highlighted, is_parent, is_zombie, line, parent_frame_id_list, unique_hash,
                encoded_locals, ordered_varnames }) {
    this.frameId = frame_id;
    this.funcName = func_name;
    this.isHighlighted = is_highlighted;
    this.line = line;
    this.isParent = is_parent;
    this.isZombie = is_zombie;
    this.parentFrameIdList = parent_frame_id_list;
    this.uniqueHash = unique_hash;
    this.encoded_locals = Utils.mapValues(Variable, encoded_locals);
    this.ordered_varnames = ordered_varnames;
  }
}
