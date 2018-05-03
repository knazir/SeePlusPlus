import Utils from "../utils/Utils";

export default class Variable {
  static get CTypes() {
    return { ARRAY: "C_ARRAY", DATA: "C_DATA", STRUCT: "C_STRUCT", STRUCT_ARRAY: "C_STRUCT_ARRAY"};
  }

  constructor(data, heap = {}) {
    this.name = null;
    const [ cType, address, type ] = data;
    this.cType = cType;
    this.address = address;
    if (cType === Variable.CTypes.ARRAY) {
      this.setupArray(data);
    } else if (cType === Variable.CTypes.STRUCT) {
      this.setupStruct(data, heap);
      if (type === "string") this.setupString(data, heap);
    } else {
      this.type = type;
      this.value = data[3];
    }
  }

  setupArray(data, heap) {
    this.type = "array";
    this.value = Utils.arrayOfType(Variable, data.slice(2), element => new Variable(element, heap));
    if (this.value.length === 1) {
      Object.assign(this, this.value[0]);
    } else if (this.value.length > 0 && this.value[0].cType !== Variable.CTypes.DATA) {
      this.cType = Variable.CTypes.STRUCT_ARRAY;
    }
  }

  setupStruct(data, heap) {
    this.type = data[2];
    const fieldList = data.slice(3);
    this.value = {};
    Utils.arrayOfType(Variable, fieldList, field => new Variable(field[1], heap).withName(field[0]))
      .forEach((elem) => this.value[elem.name] = elem);
  }

  setupString(data, heap) {
    this.cType = Variable.CTypes.DATA;

    // first check to see if the C string pointer is initialized
    const cStrPointer = this.value["_M_dataplus"].value["_M_p"];

    if (cStrPointer.isUninitialized()) { // string not yet initialized
      this.value = "<UNINITIALIZED>";
    } else if (!heap[cStrPointer.value]) { // doesn't exist on heap, string was optimized to be on stack
      const localBuffer = this.value["<anon_field>"].value["_M_local_buf"].value
        .filter(charVar => !charVar.isUninitialized())
        .filter(charVar => charVar.getValue() !== "\\0")
        .map(charVar => charVar.getValue())
        .join("");
      this.value = `"${localBuffer}"`;
    } else { // string is on the heap, get value and make sure it's not rendered as part of the heap
      this.value = heap[cStrPointer.value].getValue();
      delete heap[cStrPointer.value];
    }
  }

  withName(name) {
    this.name = name;
    return this;
  }

  isUninitialized() {
    return this.value === "<UNINITIALIZED>";
  }

  isNull() {
    return (this.type === "pointer" || this.type === "array") && this.value === "0x0";
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
      return this.value.map((elem) => elem.getValue().toString()).join(", ");
    } else {
      return this.value;
    }
  }

  toString() {
    return `${this.type} ${this.name || ""}`.trim();
  }
}
