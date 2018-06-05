import React from "react";
import Dagre from "dagre";

import Variable from "../models/Variable";
import StackFrameCard from "../visualization/StackFrameCard";
import VariableCard from "../visualization/VariableCard";
import VisualConstants from "./VisualConstants";

class VisualizationTool {
  //////////// Static Properties ////////////

  static get Layouts() {
    return { ROW: "ROW", COLUMN: "COLUMN" };
  }

  //////////// Dimension Calculation ////////////

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

    if (!stackFrame.expanded) {
      calculatedHeight = VisualConstants.StackFrameCard.SIZING.TITLE_HEIGHT;
      maxVarWidth = 0;
    }

    return {
      width: Math.max(Math.max(stackFrame.getFuncName().length * 15, minWidth), maxVarWidth),
      height: Math.max(calculatedHeight, VisualConstants.StackFrameCard.SIZING.MIN_HEIGHT)
    };
  }

  //////////// Color ////////////

  static getColor(component) {
    if (component instanceof VariableCard) {
      const COLOR_TYPES = VisualConstants.VariableCard.COLORS.TYPES;
      if (component.props.variable.orphaned) return COLOR_TYPES.ORPHANED;
      return COLOR_TYPES[component.props.variable.type] || COLOR_TYPES.DEFAULT;
    } else if (component instanceof StackFrameCard) {
      const { ACTIVE, INACTIVE } = VisualConstants.StackFrameCard.COLORS;
      return component.props.stackFrame.active ? ACTIVE : INACTIVE;
    }
  }

  //////////// Layout ////////////

  /* nodes: a list of node objects each expected to have { width, height, component }
   * origin: a point of origin with fields { x, y } (considered to be the top left)
   * offset: the amount to offset between each element with fields { x, y }
   * layout: either row or column
   * returns: a list of node components to be rendered by React's render() method
   */
  static layoutNodes({ nodes, origin, offset, layout }) {
    let x = origin.x;
    let y = origin.y;
    const laidOutNodes = nodes.map(node => {
      const newComponent = React.cloneElement(node.component, { x, y });
      if (layout === VisualizationTool.Layouts.ROW) x += node.width;
      else if (layout === VisualizationTool.Layouts.COLUMN) y += node.height;
      x += offset.x;
      y += offset.y;
      return newComponent;
    });
    VisualizationTool.registerComponents(laidOutNodes);
    return laidOutNodes;
  }

  static layoutHeap({ nodes, origin }) {
    const graph = VisualizationTool._createGraph();

    // create nodes
    nodes.forEach(({ component, width, height }) => {
      graph.setNode(component.props.variable.getId(), { component, width, height });
    });

    // create edges
    nodes.forEach(({ component }) => {
      const variable = component.props.variable;
      variable.getTargetVariables().forEach(targetVar => graph.setEdge(variable.getId(), targetVar.getId()));
    });

    // create "phantom" edges
    const components = Dagre.graphlib.alg.components(graph);
    const sinks = graph.sinks();
    const sources = graph.sources();

    for (let i = 1; i < components.length; i++) {
      const prevComponent = new Set(components[i - 1]);
      const component = new Set(components[i]);
      const prevSinks = sinks.filter(sink => prevComponent.has(sink));
      const currSources = sources.filter(source => component.has(source));
      prevSinks.forEach(sink => currSources.forEach(source => graph.setEdge(sink, source)));
    }

    // adjust layout
    Dagre.layout(graph);
    window.graph = graph;

    // fix built-in offset by finding min x and y coordinates of resulting graph
    let minX = Infinity;
    let minY = Infinity;
    graph.nodes().forEach(id => {
      const { x, y } = graph.node(id);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    });
    origin.x -= minX;
    origin.y -= minY;

    // create, register, and return components with new coordinates
    const laidOutNodes = graph.nodes().map(id => {
      let { x, y, component } = graph.node(id);
      x += origin.x;
      y += origin.y;
      return React.cloneElement(component, { x, y })
    });
    VisualizationTool.registerComponents(laidOutNodes);
    return laidOutNodes;
  }

  //////////// "State" Management ////////////

  static registerComponents(components) {
    components.forEach(component => {
      const variable = component.props.variable;
      if (!variable) return;
      const componentInfo = VisualizationTool.componentsByAddress[variable.address];
      if (componentInfo && componentInfo.variable.getId() !== variable.getId()) return;
      const { x, y } = component.props;
      VisualizationTool.componentsByAddress[variable.address] = { x, y, variable, component };
    });
  }

  static clearRegisteredComponents() {
    VisualizationTool.componentsByAddress = {};
  }

  static registerArrowComponent(arrowComponent) {
    const newComponent = React.cloneElement(arrowComponent, { key: VisualizationTool._getNextArrowId() });
    VisualizationTool.arrowComponents.push(newComponent);
  }

  static clearArrowComponents() {
    VisualizationTool.arrowComponents = [];
  }

  //////////// "State" Querying ////////////

  static getComponentByAddress(address) {
    return VisualizationTool.componentsByAddress[address];
  }

  static getArrowComponents() {
    return VisualizationTool.arrowComponents;
  }

  //////////// Helper Methods ////////////

  static _getNextArrowId() {
    return VisualizationTool.arrowId++;
  }

  static _createGraph() {
    const graph = new Dagre.graphlib.Graph();
    graph.setGraph({
      rankDir: "TB",
      rankSep: 20,
      marginX: 0,
      marginY: 0
    });
    graph.setDefaultEdgeLabel(function() { return {}; });
    return graph;
  }
}

VisualizationTool.componentsByAddress = {};
VisualizationTool.arrowComponents = [];
VisualizationTool.arrowId = 0;

window.Dagre = Dagre;
window.VisualizationTool = VisualizationTool;

export default VisualizationTool;
