import Utils from "../utils/Utils";

export default class Variable {
  static get CTypes() {
    return { ARRAY: "C_ARRAY", DATA: "C_DATA", STRUCT: "C_STRUCT", STRUCT_ARRAY: "C_STRUCT_ARRAY" };
  }

  constructor(data) {
    this.name = null;
    const [ cType, address ] = data;
    this.cType = cType;
    this.address = address;
    if (cType === Variable.CTypes.ARRAY) {
      this.type = "array";
      this.value = Utils.arrayOfType(Variable, data.slice(2));
      if (this.value.length === 1) {
        Object.assign(this, this.value[0]);
      } else if (this.value.length > 0 && this.value[0].cType !== Variable.CTypes.DATA) {
        this.cType = Variable.CTypes.STRUCT_ARRAY;
      }
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
    } else if (this.cType === Variable.CTypes.ARRAY) {
      if (this.value.length > 0 && this.value[0].type === "char") {
        const chars = this.value.slice(this.value, this.value.length - 1);
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
