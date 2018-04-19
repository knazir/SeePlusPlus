import TraceStep from "./TraceStep";
import Utils from "../Utils";

export default class ProgramTrace {
  constructor({ code, trace }) {
    this.code = code;
    this.trace = Utils.arrayOfType(TraceStep, trace);
  }
}
