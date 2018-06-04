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

  static isEmpty(obj) {
    if (!obj) return true;
    if (obj.length > 0) return false;
    if (obj.length === 0) return true;
    if (typeof obj !== "object") return true;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) return false;
    }
    return true;
  }

  static debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction() {
      const context = this;
      const args = arguments;
      const later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  };
}
