import Utils from "../utils/Utils";

export default class Variable {

  //////////// Static Properties ////////////

  static get CTypes() {
    return { ARRAY: "C_ARRAY", DATA: "C_DATA", STRUCT: "C_STRUCT", STRUCT_ARRAY: "C_STRUCT_ARRAY"};
  }

  //////////// Class ////////////

  constructor(data, stackFrame, global, heap, orphaned = false) {
    this.name = null;
    this.stackFrame = stackFrame;
    this.global = global;
    this.heap = heap;
    this.orphaned = orphaned;

    const [ cType, address, type ] = data;
    this.cType = cType;
    this.address = address;
    this._setupValue(cType, type, data);

    // used only for pointers
    this.target = null;

    // kept on hand for cloning
    this.data = data;
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
      return this.value.map(elem => elem.getValue().toString()).join(", ");
    } else if (this.type === "char") {
      return `'${this.value}'`;
    } else {
      return this.value;
    }
  }

  getId() {
    return `${this.name} ${this.address}`;
  }

  //////////// Property Querying ////////////

  isComplexType() {
    return this.cType !== Variable.CTypes.DATA;
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

  isOrphaned() {
    return this.orphaned;
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

  hasSameValue(other) {
    if (this.type !== other.type) return false;
    if (!this.isComplexType() || this.isPointer() || this.type === "string") return this.value === other.value;
    if (this.isArray()) {
      for (let i = 0; i < this.value.length; i++) {
        if (!this.value[i].hasSameValue(other.value[i])) return false;
      }
    } else if (this.isStruct()) {
      for (const fieldName of Object.keys(this.value)) {
        if (!other.value[fieldName] || !this.value[fieldName].hasSameValue(other.value[fieldName])) return false;
      }
    }
    return true;
  }

  //////////// Mutator Methods ////////////

  setName(name) {
    this.name = name;
  }

  withName(name) {
    this.setName(name);
    return this;
  }

  setTarget(targetVar) {
    this.target = targetVar;
  }

  createOrphan() {
    return new Variable(this.data, this.stackFrame, this.global, this.heap, true).withName(this.name);
  }

  getTargets() {
    let toReturn = new Set();
    if (this.type === "string") return toReturn;
    if (this.isPointer()) {
      if(!this.target || !this.target.stackFrame) return toReturn;
      toReturn.add(this.target.stackFrame);
    } else if (this.isComplexType()) {
      for (let i = 0; i < this.value.length; i++) {
        this.value[i].getTargets().forEach(elem => toReturn.add(elem));
      }
    }
    return toReturn;
  }

  //////////// Helper Methods ////////////

  _setupValue(cType, type, data) {
    if (cType === Variable.CTypes.ARRAY) {
      this._setupArray(data);
    } else if (cType === Variable.CTypes.STRUCT) {
      this._setupStruct(data);
      if (type === "string") this._setupString(data);
    } else {
      this.type = type === "pointer" ? "ptr" : type;
      this.value = data[3];
    }
  }

  _setupArray(data) {
    this.type = "array";
    this.value = Utils.arrayOfType(Variable, data.slice(2),
        varData => new Variable(varData, this.stackFrame, false, this.heap));
    // note, very important to remember if the object was orphaned! took an obscene amount of time to debug
    // is there a better way to do this?
    if (this.value.length === 1) Object.assign(this, this.value[0], { orphaned: this.orphaned });
    else if (this.value.length > 0) this.cType = Variable.CTypes.STRUCT_ARRAY;
  }

  _setupStruct(data) {
    this.type = data[2];
    const fieldList = data.slice(3);
    this.value = {};
    Utils.arrayOfType(Variable, fieldList,
        field => new Variable(field[1], this.stackFrame, false, this.heap).withName(field[0]))
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

  toString() {
    if (this.isFree()) return `(Freed) ${this.name || ""}`.trim();
    if (this.global) return `(Global) ${this.type} ${this.name || ""}`.trim();
    if (this.isOrphaned()) return `(Orphaned) ${this.name.substring(this.name.indexOf("*"))}`.trim();
    return `${this.type} ${this.name || ""}`.trim();
  }
}
