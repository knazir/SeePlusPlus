import React, { Component } from "react";
import PropTypes from "prop-types";
import { Layer, Stage } from "react-konva";

import StackFrameCard from "./StackFrameCard";
import VariableCard from "./VariableCard";
import VisualizationTool from "../utils/VisualizationTool";
import DomCard from "../components/DomCard";

export default class Visualization extends Component {
  static get propTypes() {
    return {
      width: PropTypes.number,
      height: PropTypes.number,
      trace: PropTypes.object
    };
  }

  getHeapVariableNodes() {
    const step = this.props.trace.getCurrentStep();
    return step.getHeapVariables().map(v => {
      const dimensions = VisualizationTool.getVariableCardDimensions(v);
      return {
        ...dimensions,
        component: <VariableCard key={v.name} variable={v} traceStep={step}
                                 updateVisualization={() => this.forceUpdate()}/>
      };
    });
  }

  getGlobalVariableNodes() {
    const step = this.props.trace.getCurrentStep();
    return step.getGlobalVariables().map(v => {
      const dimensions = VisualizationTool.getVariableCardDimensions(v);
      return {
        ...dimensions,
        component: <VariableCard key={v.name} variable={v} traceStep={step}
                                 updateVisualization={() => this.forceUpdate()}/>
      };
    });
  }

  getStackFrameNodes() {
    const currentStep = this.props.trace.getCurrentStep();
    return currentStep.stack.map(frame => {
      const active = frame === currentStep.getCurrentStackFrame();
      const dimensions = VisualizationTool.getStackFrameCardDimensions(frame, active);
      return {
        ...dimensions,
        component: <StackFrameCard key={frame.toString()} traceStep={currentStep} stackFrame={frame} active={active}
                                   updateVisualization={() => this.forceUpdate()}/>
      };
    });
  }

  getStackNodes() {
    const stackNodes = [...this.getGlobalVariableNodes(), ...this.getStackFrameNodes()];
    return VisualizationTool.layoutNodes({
      nodes: stackNodes,
      origin: { x: 10, y: 40 },
      offset: { x: 0, y: 15 },
      traceStep: this.props.trace.getCurrentStep(),
      layout: VisualizationTool.Layouts.COLUMN
    });
  }

  getHeapNodes() {
    return VisualizationTool.layoutNodes({
      nodes: this.getHeapVariableNodes(),
      origin: { x: (this.props.width / 2.0) + 10, y: 40 },
      offset: { x: 0, y: 15 },
      traceStep: this.props.trace.getCurrentStep(),
      layout: VisualizationTool.Layouts.COLUMN
    });
  }

  getAllNodes() {
    return [...this.getHeapNodes(), ...this.getStackNodes()];
  }

  getEmptyVisualization() {
    const height = this.props.height * 0.87;
    return (
      <div className="visualization" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard splitTitle={true} height={height} title="Stack" title2="Heap" color="lightgray"
                 bodyStyle={{ width: this.props.width, height }}/>
      </div>
    );
  }

  render() {
    // clear previously registered nodes
    VisualizationTool.clearRegisteredComponents();
    const height = this.props.height * 0.87;
    if (!this.props.trace) return this.getEmptyVisualization();
    return (
      <div className="visualization" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard splitTitle={true} height={height} title="Stack" title2="Heap" color="lightgray"
                 bodyStyle={{ width: this.props.width, height }}>
          <Stage draggable width={this.props.width} height={this.props.height}>
            <Layer>
              {this.getAllNodes()}
            </Layer>
          </Stage>
        </DomCard>
      </div>
    );
  }
}
