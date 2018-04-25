import TraceStep from "./TraceStep";
import Utils from "../utils/Utils";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
  }
}
