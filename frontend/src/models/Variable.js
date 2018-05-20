import Utils from "../utils/Utils";

export default class Variable {

  //////////// Static Properties ////////////

  static get CTypes() {
    return { ARRAY: "C_ARRAY", DATA: "C_DATA", STRUCT: "C_STRUCT", STRUCT_ARRAY: "C_STRUCT_ARRAY"};
  }

  //////////// Class ////////////

  constructor(data, heap = {}, stackFrameHash, global = false) {
    this.name = null;
    this.stackFrameHash = stackFrameHash;
    const [ cType, address, type ] = data;
    this.cType = cType;
    this.address = address;
    this.heap = heap;
    if (cType === Variable.CTypes.ARRAY) {
      this._setupArray(data);
    } else if (cType === Variable.CTypes.STRUCT) {
      this._setupStruct(data);
      if (type === "string") this._setupString(data);
    } else {
      this.type = type === "pointer" ? "ptr" : type;
      this.value = data[3];
    }
    this.orphaned = false;
    this.global = global;
  }

  //////////// Getters ////////////

  getValue() {
    if (this.isUninitialized()) {
      return "?";
    } else if (this.type === "bool") {
      return Boolean(this.value).toString();
    } else if (this.cType === Variable.CTypes.ARRAY) {
      if (this.value.length > 0 && this.value[0].type === "char") {
        const chars = this.value.slice(this.value, this.value.length - 1).filter(value => value !== "\\0");
        const str = chars.map(c => c.getValue()).join("");
        return `"${str}"`;
      }
      return this.value.map((elem) => elem.getValue().toString()).join(", ");
    } else if (this.type === "char") {
      return `'${this.value}'`;
    } else {
      return this.value;
    }
  }

  getId() {
    return `${this.toString()} ${this.address}`;
  }

  //////////// Property Querying ////////////

  isComplexType() {
    return Variable.CTypes[this.cType] !== Variable.CTypes.DATA;
  }

  isArray() {
    return this.cType  === Variable.CTypes.ARRAY || this.cType === Variable.CTypes.STRUCT_ARRAY;
  }

  isStruct() {
    return this.cType === Variable.CTypes.STRUCT;
  }

  isFree() {
    return Boolean(this.heap[this.address]) && this.isArray() && this.value.length === 0;
  }

  isPointer() {
    return this.type === "ptr";
  }

  isUninitialized() {
    return this.value === "<UNINITIALIZED>" || this.value === "<UNALLOCATED>";
  }

  isNull() {
    return (this.type === "ptr" || this.type === "array") && this.value === "0x0";
  }

  toString() {
    if (this.isFree()) return `(Freed) ${this.name || ""}`.trim();
    if (this.global) return `(Global) ${this.type} ${this.name || ""}`.trim();
    if (this.orphaned) return `(Orphaned) ${this.name.substring(this.name.indexOf("*"))}`.trim();
    return `${this.type} ${this.name || ""}`.trim();
  }

  //////////// Mutator Methods ////////////

  withName(name) {
    this.name = name;
    return this;
  }

  //////////// Helper Methods ////////////

  _setupArray(data) {
    this.type = "array";
    this.value = Utils.arrayOfType(Variable, data.slice(2), element => new Variable(element, this.heap));
    if (this.value.length === 1) Object.assign(this, this.value[0]);
    else if (this.value.length > 0) this.cType = Variable.CTypes.STRUCT_ARRAY;
  }

  _setupStruct(data) {
    this.type = data[2];
    const fieldList = data.slice(3);
    this.value = {};
    Utils.arrayOfType(Variable, fieldList, field => new Variable(field[1], this.heap).withName(field[0]))
      .forEach((elem) => this.value[elem.name] = elem);
  }

  _setupString(data) {
    this.cType = Variable.CTypes.DATA;

    // first check to see if the C string pointer is initialized
    const cStrPointer = this.value["_M_dataplus"].value["_M_p"];

    if (cStrPointer.isUninitialized()) { // string not yet initialized
      this.value = "<UNINITIALIZED>";
    } else if (!this.heap[cStrPointer.value]) { // doesn't exist on heap, string was optimized to be on stack
      const localBuffer = this._formatString(this.value["<anon_field>"].value["_M_local_buf"].value);
      this.value = `"${localBuffer}"`;
    } else { // string is on the heap, get value and make sure it's not rendered as part of the heap
      const heapValue = this._formatString(this.heap[cStrPointer.value].value);
      this.value = `"${heapValue}"`;
      delete this.heap[cStrPointer.value];
    }
  }

  _formatString(value) {
    return value.filter(charVar => !charVar.isUninitialized())
      .filter(charVar => charVar.value !== "\\0")
      .map(charVar => charVar.value)
      .join("");
  }
}
