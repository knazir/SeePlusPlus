import React from "react";

import Variable from "../models/Variable";
import StackFrameCard from "../visualization/StackFrameCard";
import VariableCard from "../visualization/VariableCard";
import VisualConstants from "./VisualConstants";

class VisualizationTool {
  static get Layouts() {
    return { ROW: "ROW", COLUMN: "COLUMN" };
  }

  static getVariableCardDimensions(variable) {
    let calculatedHeight = VisualConstants.VariableCard.SIZING.HEIGHT;
    let maxFieldWidth = 0;

    if (variable.cType === Variable.CTypes.STRUCT) {
      const offsetY = VisualConstants.VariableCard.SIZING.SPACE_BETWEEN;
      const fields = Object.values(variable.value);
      calculatedHeight = fields.map(v => VisualizationTool.getVariableCardDimensions(v).height)
        .reduce((total, height) => total + height + offsetY, 0);
      calculatedHeight += VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + offsetY;
      maxFieldWidth = Math.max.apply(null, fields.map(v => VisualizationTool.getVariableCardDimensions(v).width));
    } else if (variable.cType === Variable.CTypes.STRUCT_ARRAY) {
      const offset = VisualConstants.VariableCard.SIZING.ARRAY_SPACE_BETWEEN;
      const fields = Object.values(variable.value);
      maxFieldWidth = fields.map(v => VisualizationTool.getVariableCardDimensions(v).width)
        .reduce((total, width) => total + width + offset, 0);
      calculatedHeight = VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + 15;
      calculatedHeight += Math.max.apply(null, fields.map(v => VisualizationTool.getVariableCardDimensions(v).height));
    }

    const valueHeight = calculatedHeight - VisualConstants.VariableCard.SIZING.TITLE_HEIGHT;
    const offsetToValueCenter = VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + (valueHeight / 2.0);
    const titleWidth = variable.toString().length + 2;
    const valueWidth = variable.getValue().toString().length * 1.25 + 2;
    const minWidth = VisualConstants.VariableCard.SIZING.MIN_WIDTH;
    let calculatedWidth = 0;
    if (variable.isPointer()) {
      calculatedWidth = Math.max(Math.max(titleWidth, minWidth) * 10 + 7, maxFieldWidth + 14);
    } else {
      calculatedWidth = Math.max(Math.max(titleWidth, valueWidth, minWidth) * 10 + 7, maxFieldWidth + 14);
    }

    return {
      width: calculatedWidth,
      height: calculatedHeight,
      centerOffset: offsetToValueCenter
    };
  }

  static getStackFrameCardDimensions(stackFrame) {
    const offsetY = VisualConstants.VariableCard.SIZING.SPACE_BETWEEN;
    const dimensions = stackFrame.getLocalVariables().map(v => VisualizationTool.getVariableCardDimensions(v));

    let maxVarWidth = Math.max.apply(null, dimensions.map(d => d.width)) + 14;
    const minWidth = VisualConstants.StackFrameCard.SIZING.MIN_WIDTH;

    let calculatedHeight = dimensions.map(d => d.height).reduce((total, height) => total + height + offsetY, 0);
    calculatedHeight += VisualConstants.StackFrameCard.SIZING.TITLE_HEIGHT + offsetY + offsetY;
    if (!VisualizationTool.isExpanded(stackFrame)) {
      calculatedHeight = VisualConstants.StackFrameCard.SIZING.TITLE_HEIGHT;
      maxVarWidth = 0;
    }

    return {
      width: Math.max(Math.max(stackFrame.getFuncName().length * 15, minWidth), maxVarWidth),
      height: Math.max(calculatedHeight, VisualConstants.StackFrameCard.SIZING.MIN_HEIGHT)
    };
  }

  static getColor(component) {
    if (component instanceof VariableCard) {
      const COLOR_TYPES = VisualConstants.VariableCard.COLORS.TYPES;
      if (component.props.variable.orphaned) return COLOR_TYPES.ORPHANED;
      return COLOR_TYPES[component.props.variable.type] || COLOR_TYPES.DEFAULT;
    } else if (component instanceof StackFrameCard) {
      const { ACTIVE, INACTIVE } = VisualConstants.StackFrameCard.COLORS;
      return component.props.active ? ACTIVE : INACTIVE;
    }
  }

  // nodes: a list of node objects each expected to have { width, height, component }
  // origin: a point of origin with fields { x, y } (considered to be the top left)
  // offset: the amount to offset between each element with fields { x, y }
  // layout: either row or column
  // returns: a list of node components to be rendered by React's render() method
  static layoutNodes({ nodes, origin, offset, traceStep, otherNodes = [], layout }) {
    let x = origin.x;
    let y = origin.y;
    const layedOutNodes = nodes.map(node => {
      const newComponent = React.cloneElement(node.component, { x, y });
      if (layout === VisualizationTool.Layouts.ROW) x += node.width;
      else if (layout === VisualizationTool.Layouts.COLUMN) y += node.height;
      x += offset.x;
      y += offset.y;
      return newComponent;
    });
    VisualizationTool.registerComponents(layedOutNodes);
    return layedOutNodes;
  }

  static registerComponents(components) {
    components.forEach(component => {
      const variable = component.props.variable;
      if (!variable || VisualizationTool.componentsByAddress[variable.address]) return;
      const { x, y } = component.props;
      VisualizationTool.componentsByAddress[variable.address] = { x, y, variable, component };
    });
  }

  static registerStackFrame(frame, expanded, active) {
    VisualizationTool.stackFrames[frame.uniqueHash] = { expanded, active };
  }

  static isExpanded(frame) {
    const stackFrameInfo = VisualizationTool.stackFrames[frame.uniqueHash];
    return stackFrameInfo && (stackFrameInfo.expanded || (stackFrameInfo.pointee && !stackFrameInfo.closedPointee));
  }

  static updateStackFrameActiveness(frame, active) {
    if (!VisualizationTool.stackFrames[frame.uniqueHash]) {
      VisualizationTool.registerStackFrame(frame, active, active);
    } else if (VisualizationTool.stackFrames[frame.uniqueHash].active !== active) {
        VisualizationTool.stackFrames[frame.uniqueHash] = { "expanded": active, active,
          "pointee": false, "closedPointee": false };
    }
  }

  static toggleStackFrame(frame) {
    const frameInfo = VisualizationTool.stackFrames[frame.uniqueHash];
    if (frameInfo.pointee) {
      VisualizationTool.stackFrames[frame.uniqueHash].closedPointee = !frameInfo.closedPointee;
    } else {
      VisualizationTool.stackFrames[frame.uniqueHash].expanded = !frameInfo.expanded;
    }
  }

  static resetViewedFrames() {
    for (let hash in VisualizationTool.stackFrames) {
      VisualizationTool.stackFrames[hash].pointee = false;
    }
  }

  static getComponentByAddress(address) {
    return VisualizationTool.componentsByAddress[address];
  }

  static clearRegisteredComponents() {
    VisualizationTool.componentsByAddress = {};
  }

  static clearPointerArrows() {
    VisualizationTool.arrowsToDraw = [];
  }

  static getArrowComponents() {
    return VisualizationTool.arrowsToDraw;
  }

  static clearHeapRegisteredComponents() {
    const components = VisualizationTool.componentsByAddress;
    VisualizationTool.clearRegisteredComponents();
    for (const address in components) {
      const variable = components[address].variable;
      if (variable.stackFrameHash || variable.global) {
        VisualizationTool.componentsByAddress[address] = components[address];
      }
    }
  }
}

VisualizationTool.componentsByAddress = {};
VisualizationTool.stackFrames = {};
VisualizationTool.arrowsToDraw = [];

export default VisualizationTool;
