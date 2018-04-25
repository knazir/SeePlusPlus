export default class Utils {
  static arrayOfType(Type, array, producer) {
    return array.map(element => {
      if (element instanceof Type) {
        return element;
      } else {
        return producer ? producer(element) : new Type(element);
      }
    });
  }

  static mapValues(Type, obj, producer) {
    const result = {};
    Object.keys(obj).forEach(key => {
      const element = obj[key];
      if (!(element instanceof Type)) {
        result[key] = producer ? producer(element) : new Type(element);
      }
    });
    return result;
  }
}
