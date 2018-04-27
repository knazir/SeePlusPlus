import React, { Component } from "react";
import PropTypes from "prop-types";
import { Layer, Stage } from "react-konva";

import StackFrameCard from "./StackFrameCard";
import VariableCard from "./VariableCard";

export default class Visualization extends Component {
  static get propTypes() {
    return {
      width: PropTypes.number,
      height: PropTypes.number,
      trace: PropTypes.object
    };
  }

  getGlobalVariableNodes() {
    return this.props.trace.getCurrentStep().getGlobalVariables().map(v => {
      return <VariableCard key={v.name} variable={v} x={30} y={30}/>;
    });
  }

  getStackFrameNodes() {
    const currentStep = this.props.trace.getCurrentStep();
    return currentStep.stack.map(frame => {
      const active = frame === currentStep.getCurrentStackFrame();
      return <StackFrameCard key={frame.toString()} stackFrame={frame} active={active} x={30} y={30}/>;
    });
  }

  render() {
    if (!this.props.trace) return <div style={{ width: this.props.width, height: this.props.height }}/>;
    return (
      <Stage ref={e => this.node = e} width={this.props.width} height={this.props.height}>
        <Layer>
          {this.getGlobalVariableNodes()}
          {this.getStackFrameNodes()}
        </Layer>
      </Stage>
    );
  }
}
