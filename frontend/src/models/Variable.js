import Utils from "../utils/Utils";

export default class Variable {

  //////////// Static Properties ////////////

  static get CTypes() {
    return { ARRAY: "C_ARRAY", DATA: "C_DATA", STRUCT: "C_STRUCT", STRUCT_ARRAY: "C_STRUCT_ARRAY",
      MULTI_DIM_ARRAY: "C_MULTIDIMENSIONAL_ARRAY"};
  }

  //////////// Class ////////////

  constructor(data, stackFrame, global, heap, parent = null, orphaned = false, isArrayElem = false) {
    this.name = null;
    this.stackFrame = stackFrame;
    this.global = global;
    this.heap = heap;
    this.parent = parent || this;
    this.orphaned = orphaned;

    const [ cType, address, type ] = data;
    this.cType = cType;
    this.address = address;
    this.isArrayElem = isArrayElem;
    this._setupValue(cType, type, data);

    // used only for pointers
    this.target = null;

    // kept on hand for cloning
    this.data = data;
  }

  //////////// Getters ////////////

  getTargetVariables() {
    const toReturn = new Set();
    if (this.isPointer() && this.target) {
      toReturn.add(this.target.parent);
    } else if (this.isComplexType()) {
      Object.values(this.value).forEach(member => {
        member.getTargetVariables().forEach(memberTarget => toReturn.add(memberTarget));
      });
    }
    return toReturn;
  }

  getTargetStackFrames() {
    const toReturn = new Set();
    if (this.type === "string") return toReturn;
    if (this.isPointer()) {
      if(!this.target || !this.target.stackFrame) return toReturn;
      toReturn.add(this.target.stackFrame);
    } else if (this.isMultiDimArray()) {
      for (let i = 0; i < this.value.length; i++) {
        for (let j = 0; j < this.value[i].length; j++) {
          this.value[i][j].getTargetStackFrames().forEach(elem => toReturn.add(elem));
        }
      }
    } else if (this.isComplexType()) {
      for (let i = 0; i < this.value.length; i++) {
        this.value[i].getTargetStackFrames().forEach(elem => toReturn.add(elem));
      }
    }
    return toReturn;
  }

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

  isMultiDimArray() {
    return this.cType === Variable.CTypes.MULTI_DIM_ARRAY;
  }

  isTree() {
    if (!this.isStruct()) return false;
    const numPointers = Object.values(this.value).filter(elem => elem.isPointer()).length;
    if (numPointers <= 1) return false;
    if (numPointers >= 3) return true;
    const regex = /ne?xt/i;
    return !(Object.values(this.value).filter(elem => elem.isPointer() && regex.exec(elem.name))[0]);
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

  setTargetVariable(variables) {
    if (this.isPointer()) {
      for (const otherVar of variables) {
        if (otherVar.address === this.getValue()) {
          this.target = otherVar;
          if (otherVar.stackFrame && this.stackFrame) otherVar.stackFrame.registerStackFrameSource(this.stackFrame);
          break;
        }
      }
    } else if (this.isMultiDimArray()) {
      for (let i = 0; i < this.value.length; i++) {
        for (let j = 0; j < this.value[i].length; j++) {
          this.value[i][j].setTargetVariable(variables);
        }
      }
    } else if (this.isComplexType()) {
      Object.values(this.value).forEach(member => member.setTargetVariable(variables));
    }
  }

  createOrphan() {
    return new Variable(this.data, this.stackFrame, this.global, this.heap, this.parent, true).withName(this.name);
  }

  //////////// Helper Methods ////////////

  _setupValue(cType, type, data) {
    if (cType === Variable.CTypes.ARRAY) {
      this._setupArray(data);
    } else if (cType === Variable.CTypes.STRUCT) {
      this._setupStruct(data);
      if (type === "string") this._setupString(data);
    } else if (cType === Variable.CTypes.MULTI_DIM_ARRAY) {
      this._setupMultiDimArray(data);
    } else {
      this.type = type === "pointer" ? "ptr" : type;
      this.value = data[3];
    }
  }

  _setupArray(data) {
    this.type = "array";
    this.value = [];
    const values = data.slice(2);
    for (let i = 0; i < values.length; i++) {
      this.value.push(new Variable(values[i], this.stackFrame, false, this.heap, this.parent, false, true)
        .withName("" + i));
    }
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
        field => new Variable(field[1], this.stackFrame, false, this.heap, this.parent).withName(field[0]))
      .forEach((elem) => this.value[elem.name] = elem);
  }

  _setupMultiDimArray(data) {
    this.type = "multi_dim_array";
    if (data[2].length > 2) {
      this.value = [];
      throw new Error("We do not support arrays with more than 2 dimensions");
    }
    const [rows, cols] = data[2];
    this.value = new Array(rows);
    for (let i = 0; i < rows; i++) {
      this.value[i] = new Array(cols);
    }
    const values = data.slice(3);
    for (let i = 0; i < values.length; i++) {
      this.value[Math.floor(i / cols)][i % cols] =
        new Variable(values[i], this.stackFrame, false, this.heap, this.parent, false, true)
          .withName(`(${Math.floor(i / cols)}, ${i % cols})`);
    }
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

  _getType() {
    if (this.isArrayElem) return "";
    if (this.isMultiDimArray()) return "array";
    return this.type;
  }

  toString() {
    if (this.isFree()) return `(Freed) ${this.name || ""}`.trim();
    if (this.global) return `(Global) ${this.type} ${this.name || ""}`.trim();
    if (this.isOrphaned()) return `(Orphaned) ${this.name.substring(this.name.indexOf("*"))}`.trim();
    return `${this._getType()} ${this.name || ""}`.trim();
  }
}
