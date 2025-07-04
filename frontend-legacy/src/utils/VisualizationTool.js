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

  // calcMultiArray is a boolean to prevent infinite recursion. Should be true if trying to calculate parent array dims
  static getVariableCardDimensions(variable, calcMultiArray = false) {
    let calculatedHeight = VisualConstants.VariableCard.SIZING.HEIGHT;
    let maxFieldWidth = 0;

    if (variable.multiArray && !calcMultiArray) {
      const { width, height } = VisualizationTool._getBiggestDimsMultiArray(variable.multiArray);
      const valueHeight = calculatedHeight - VisualConstants.VariableCard.SIZING.TITLE_HEIGHT;
      const offsetToValueCenter = VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + (valueHeight / 2.0);
      return {
        width,
        height,
        centerOffset: offsetToValueCenter
      };
    }

    if (variable.isTree()) {
      const offset = VisualConstants.VariableCard.SIZING.SPACE_BETWEEN;
      const fields = Object.values(variable.value);
      calculatedHeight = fields.filter(v => !v.isPointer())
        .map(v => VisualizationTool.getVariableCardDimensions(v).height)
        .reduce((total, height) => total + height + offset, 0);
      const pointer = fields.filter(v => v.isPointer())[0];
      calculatedHeight += offset + VisualizationTool.getVariableCardDimensions(pointer).height;
      calculatedHeight += VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + offset;
      maxFieldWidth = Math.max.apply(null, fields.filter(field => !field.isPointer())
        .map(v => VisualizationTool.getVariableCardDimensions(v).width));
      const treeFieldWidth = fields.filter(field => field.isPointer())
        .map(v => VisualizationTool.getVariableCardDimensions(v).width)
        .reduce((total, width) => total + width + offset, 0) - offset;
      maxFieldWidth = Math.max(maxFieldWidth, treeFieldWidth);
    } else if (variable.isMultiDimArray()) {
      const { width, height } = VisualizationTool._getBiggestDimsMultiArray(variable);
      const nodes = variable.value;
      calculatedHeight = height * nodes.length + VisualConstants.VariableCard.SIZING.SPACE_BETWEEN;
      const offsetY = VisualConstants.VariableCard.SIZING.SPACE_BETWEEN;
      calculatedHeight += VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + offsetY;
      maxFieldWidth = nodes.length > 0 ? width * nodes[0].length : 0;
    } else if (variable.cType === Variable.CTypes.STRUCT) {
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
      calculatedHeight = VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + 20; // number gives top + bottom padding
      calculatedHeight += Math.max.apply(null, fields.map(v => VisualizationTool.getVariableCardDimensions(v).height));
    }

    const valueHeight = calculatedHeight - VisualConstants.VariableCard.SIZING.TITLE_HEIGHT;
    const offsetToValueCenter = VisualConstants.VariableCard.SIZING.TITLE_HEIGHT + (valueHeight / 2.0);
    const titleWidth = (variable.toString().length) / 1.5 + 2;
    const valueWidth = variable.isMultiDimArray() ? 0 : variable.getValue().toString().length * 1.25 + 2;
    const minWidth = VisualConstants.VariableCard.SIZING.MIN_WIDTH;
    let calculatedWidth = 0;
    if (variable.isPointer()) {
      calculatedWidth = Math.max(Math.max(titleWidth, minWidth) * 10 + 7, maxFieldWidth + 10);
    } else if (variable.cType === Variable.CTypes.STRUCT) {
      calculatedWidth = Math.max(Math.max(titleWidth, minWidth) * 10 + 7, maxFieldWidth + 10);
    } else {
      calculatedWidth = Math.max(Math.max(titleWidth, valueWidth, minWidth) * 10 + 7, maxFieldWidth + 10);
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
  static layoutNodes({ nodes, origin, offset, layout, componentWidth }) {
    let x = origin.x;
    let y = origin.y;
    let totalWidth = 0;
    if (layout === VisualizationTool.Layouts.ROW) {
      totalWidth = nodes.reduce((total, node) => total + node.width + offset.x, 0) - offset.x;
    }
    const laidOutNodes = nodes.map(node => {
      let nodeX = x;
      if (componentWidth) {
        nodeX = x + (componentWidth - (layout === VisualizationTool.Layouts.COLUMN ? node.width : totalWidth)) / 2;
      }
      const newComponent = React.cloneElement(node.component, { x: nodeX, y });
      if (layout === VisualizationTool.Layouts.ROW) x += node.width;
      else if (layout === VisualizationTool.Layouts.COLUMN) y += node.height;
      x += offset.x;
      y += offset.y;
      return newComponent;
    });
    VisualizationTool.registerComponents(laidOutNodes);
    return laidOutNodes;
  }

  static layoutTreeNodes({ nodes, origin, offset, componentWidth }) {
    let x = origin.x;
    let y = origin.y;
    const nonPtrNodes = nodes.filter(node => !node.component.props.variable.isPointer()).map(node => {
      const newComponent = React.cloneElement(node.component, { x: x + (componentWidth - node.width) / 2, y });
      y += node.height;
      y += offset;
      return newComponent;
    });
    const ptrComponents = nodes.filter(node => node.component.props.variable.isPointer());
    const treeWidth = ptrComponents.reduce((total, node) => total + node.width + offset, 0) - offset;
    const ptrNodes = ptrComponents.map(node => {
      const newComponent = React.cloneElement(node.component, { x: x + (componentWidth - treeWidth) / 2, y });
      x += node.width;
      x += offset;
      return newComponent;
    });
    const laidOutNodes = nonPtrNodes.concat(ptrNodes);
    VisualizationTool.registerComponents(laidOutNodes);
    return laidOutNodes;
  }

  static layoutMultiDimArrayNodes({ nodes, origin, offset, componentWidth }) {
    let x = origin.x;
    let y = origin.y;
    let width = 0;
    let height = 0;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        width = Math.max(width, nodes[i][j].width);
        height = Math.max(height, nodes[i][j].height);
      }
    }
    if (nodes.length === 0) return; // shouldn't need this
    const laidOutNodes = new Array(nodes.length * nodes[0].length);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes[i].length; j++) {
        let nodeX = x;
        nodeX = x + (componentWidth - nodes[0].length * width) / 2;
        let node = nodes[i][j];
        laidOutNodes[i * nodes[i].length + j] = React.cloneElement(node.component,
          { x: nodeX, y, width: width, height: height });
        x += width + offset.x;
      }
      y += offset.y;
      y += height;
      x = origin.x;
    }
    VisualizationTool.registerComponents(laidOutNodes);
    return laidOutNodes;
  }

  static layoutHeap({ nodes, origin }) {
    let graph = VisualizationTool._createGraph();
    this.createBasicGraph(graph, nodes);

    // create "phantom" edges
    const components = Dagre.graphlib.alg.components(graph);
    const sinks = graph.sinks();
    const sources = graph.sources();
    let shouldReLayout = false;

    for (let i = 1; i < components.length; i++) {
      const prevComponent = new Set(components[i - 1]);
      const component = new Set(components[i]);
      const prevSinks = sinks.filter(sink => prevComponent.has(sink));
      const currSources = sources.filter(source => component.has(source));
      if (prevSinks.length === 0 || currSources.length === 0) {
        shouldReLayout = true;
      }
      prevSinks.forEach(sink => currSources.forEach(source => graph.setEdge(sink, source)));
    }

    // adjust layout
    Dagre.layout(graph);
    window.graph = graph;

    if (shouldReLayout) {
      const finalGraph = VisualizationTool._createGraph();
      this.createBasicGraph(finalGraph, nodes);

      // create "phantom" edges
      const components = Dagre.graphlib.alg.components(finalGraph);
      const sinks = finalGraph.sinks();
      const sources = finalGraph.sources();

      for (let i = 1; i < components.length; i++) {
        const prevComponent = new Set(components[i - 1]);
        const component = new Set(components[i]);
        const prevSinks = sinks.filter(sink => prevComponent.has(sink));
        const currSources = sources.filter(source => component.has(source));
        if (prevSinks.length === 0) {
          let lowest = components[i - 1][0];
          for (let j = 1; j < components[i - 1].length; j++) {
            if (graph.node(components[i - 1][j]).y > graph.node(lowest).y) {
              lowest = components[i - 1][j];
            }
          }
          prevSinks.push(lowest);
        }
        if (currSources.length === 0) {
          let highest = components[i][0];
          for (let j = 1; j < components[i].length; j++) {
            if (graph.node(components[i][j]).y < graph.node(highest).y) {
              highest = components[i][j];
            }
          }
          currSources.push(highest);
        }
        prevSinks.forEach(sink => currSources.forEach(source => finalGraph.setEdge(sink, source)));
      }

      Dagre.layout(finalGraph);
      graph = finalGraph;
    }

    // create, register, and return components with new coordinates
    // convert Dagre center coordinates to top left of the corner of component
    const laidOutNodes = graph.nodes().map(id => {
      let { x, y, component, width, height } = graph.node(id);
      x += origin.x - width / 2;
      y += origin.y - height / 2;
      return React.cloneElement(component, { x, y });
    });
    VisualizationTool.registerComponents(laidOutNodes);
    return laidOutNodes;
  }

  static createBasicGraph(graph, nodes) {
    // create nodes
    nodes.forEach(({ component, width, height }) => {
      graph.setNode(component.props.variable.getId(), { component, width, height });
    });

    // create edges
    nodes.forEach(({ component }) => {
      const variable = component.props.variable;
      variable.getTargetVariables().forEach(targetVar => graph.setEdge(variable.getId(), targetVar.getId()));
    });
  }

  //////////// "State" Management ////////////

  static registerComponents(components) {
    components.forEach(component => {
      if (component.props.stackFrame) return VisualizationTool.registerStackFrameComponent(component);
      const variable = component.props.variable;
      if (!variable) return;
      const componentInfo = VisualizationTool.componentsByAddress[variable.address];
      if (componentInfo && componentInfo.variable.getId() !== variable.getId()) return;
      const { x, y } = component.props;
      VisualizationTool.componentsByAddress[variable.address] = { x, y, variable, component };
    });
  }

  static registerStackFrameComponent(component) {
    const { stackFrame, x, y } = component.props;
    VisualizationTool.stackFrameComponents[stackFrame.getId()] = { x, y, stackFrame, component };
  }

  static clearRegisteredComponents() {
    VisualizationTool.componentsByAddress = {};
    VisualizationTool.stackFrameComponents = {};
  }

  static registerArrowComponent(variable, arrowComponent) {
    const newComponent = React.cloneElement(arrowComponent, { key: VisualizationTool._getNextArrowId() });
    if (variable.stackFrame) {
      const stackFrameId = variable.stackFrame.getId();
      if (VisualizationTool.arrowComponents[stackFrameId]) {
        VisualizationTool.arrowComponents[stackFrameId].push(newComponent);
      } else {
        VisualizationTool.arrowComponents[stackFrameId] = [newComponent];
      }
    } else {
      VisualizationTool.arrowComponents[variable.getId()] = [newComponent];
    }
  }

  static clearAllArrowComponents() {
    VisualizationTool.arrowComponents = {};
  }

  static clearStackFrameArrowComponents(stackFrame) {
    delete VisualizationTool.arrowComponents[stackFrame.getId()];
  }

  //////////// "State" Querying ////////////

  static getComponentByAddress(address) {
    return VisualizationTool.componentsByAddress[address];
  }

  static getStackFrameComponent(stackFrame) {
    return VisualizationTool.stackFrameComponents[stackFrame.getId()];
  }

  static getArrowComponents() {
    const result = [];
    const arrowArrays = Object.values(VisualizationTool.arrowComponents);
    arrowArrays.forEach(arr => result.push(...arr));
    return result;
  }

  //////////// Helper Methods ////////////

  static _getNextArrowId() {
    return VisualizationTool.arrowId++;
  }

  static _createGraph() {
    const graph = new Dagre.graphlib.Graph();
    graph.setGraph({
      rankDir: "TB",
      rankSep: 10,
      nodeSep: 10,
      marginX: 0,
      marginY: 0
    });
    graph.setDefaultEdgeLabel(function() { return {}; });
    return graph;
  }

  static _getBiggestDimsMultiArray(variable) {
    let width = 0;
    let height = 0;
    const nodes = variable.value;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        const dimensions = VisualizationTool.getVariableCardDimensions(nodes[i][j], true);
        width = Math.max(width, dimensions.width);
        height = Math.max(height, dimensions.height);
      }
    }
    return { width, height };
  }
}

VisualizationTool.componentsByAddress = {};
VisualizationTool.stackFrameComponents = {};
VisualizationTool.arrowComponents = [];
VisualizationTool.arrowId = 0;

window.Dagre = Dagre;
window.VisualizationTool = VisualizationTool;

export default VisualizationTool;
