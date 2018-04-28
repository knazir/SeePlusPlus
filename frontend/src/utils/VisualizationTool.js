export default class VisualizationTool {
  static getVariableCardDimensions(variable) {
    const { type, name } = variable;
    const width = Math.max(type.length + name.length + 2, variable.getValue().toString().length * 2 + 2, 5) * 10;
    const height = 50;
    return { width, height };
  }

  static getStackFrameCardDimensions(stackFrame) {
    const width =  Math.max(stackFrame.funcName.length * 2, 20) * 20;
    const height = 250;
    return { width, height };
  }
}
