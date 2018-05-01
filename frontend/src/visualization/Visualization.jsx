import React, { Component } from "react";
import PropTypes from "prop-types";
import { Layer, Stage } from "react-konva";

import StackFrameCard from "./StackFrameCard";
import VariableCard from "./VariableCard";
import VisualizationTool from "../utils/VisualizationTool";

export default class Visualization extends Component {
  static get propTypes() {
    return {
      width: PropTypes.number,
      height: PropTypes.number,
      trace: PropTypes.object
    };
  }

  getHeapVariableNodes() {
    const heapVars = this.props.trace.getCurrentStep().getHeapVariables();
    return Object.keys(heapVars).map(k => {
      const dimensions = VisualizationTool.getVariableCardDimensions(heapVars[k]);
      return { ...dimensions, component: <VariableCard key={heapVars[k].name} variable={heapVars[k]}/> };
    });
  }

  getGlobalVariableNodes() {
    return this.props.trace.getCurrentStep().getGlobalVariables().map(v => {
      const dimensions = VisualizationTool.getVariableCardDimensions(v);
      return { ...dimensions, component: <VariableCard key={v.name} variable={v}/> };
    });
  }

  getStackFrameNodes() {
    const currentStep = this.props.trace.getCurrentStep();
    return currentStep.stack.map(frame => {
      const active = frame === currentStep.getCurrentStackFrame();
      const dimensions = VisualizationTool.getStackFrameCardDimensions(frame);
      return { ...dimensions, component: <StackFrameCard key={frame.toString()} stackFrame={frame} active={active}/> };
    });
  }

  getAllNodes() {
    const origin = { x: 10, y: 40 };
    const offset = { x: 0, y: 15 };
    const nodesToLayout = [...this.getGlobalVariableNodes(), ...this.getStackFrameNodes(), ...this.getHeapVariableNodes()];
    return VisualizationTool.layoutNodes(nodesToLayout, origin, offset, VisualizationTool.Layouts.COLUMN);
  }

  render() {
    if (!this.props.trace) return <div style={{ width: this.props.width, height: this.props.height }}/>;
    return (
      <Stage draggable width={this.props.width} height={this.props.height}>
        <Layer>
          {this.getAllNodes()}
        </Layer>
      </Stage>
    );
  }
}
