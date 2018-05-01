import Utils from "../utils/Utils";

export default class Variable {
  static get CTypes() {
    return { ARRAY: "C_ARRAY", DATA: "C_DATA", STRUCT: "C_STRUCT" };
  }

  constructor(data) {
    this.name = null;
    const [ cType, address ] = data;
    this.cType = cType;
    this.address = address;
    if (cType === Variable.CTypes.ARRAY) {
      this.type = "array";
      this.value = Utils.arrayOfType(Variable, data.slice(2));
    } else if (cType === Variable.CTypes.STRUCT) {
      this.type = data[2];
      const fieldList = data.slice(3);
      this.value = {};
      Utils.arrayOfType(Variable, fieldList, (field) => new Variable(field[1]).withName(field[0]))
        .forEach((elem) => this.value[elem.name] = elem);
    } else {
      this.type = data[2];
      this.value = data[3];
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
    } else {
      return this.value;
    }
  }

  isPointer() {
    return this.type === "pointer";
  }

  toString() {
    return `${this.type} ${this.name}`;
  }
}
