import React, { Component } from "react";
import PropTypes from "prop-types";
import { Layer, Stage } from "react-konva";

import StackFrameCard from "./StackFrameCard";
import VariableCard from "./VariableCard";
import VisualizationTool from "../utils/VisualizationTool";
import DomCard from "../components/DomCard";
import { Visualization as VisualConstants } from "../utils/VisualConstants";

export default class Visualization extends Component {
  static get propTypes() {
    return {
      width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      height: PropTypes.number,
      trace: PropTypes.object
    };
  }

  constructor(props) {
    super(props);
    this.updateVisualization = this.updateVisualization.bind(this);
  }

  updateVisualization() {
    this.forceUpdate();
  }

  resolveHeapDifferences(prevStep, step) {
    if (prevStep.getHeapVariables().length !== step.getHeapVariables().length) {
      VisualizationTool.clearHeapRegisteredComponents();
      this.props.trace.prevVisualizedIndex = this.props.trace.traceIndex;
    } else {
      for (let i = 0; i < prevStep.getHeapVariables().length; i++) {
        const prevElem = prevStep.getHeapVariables()[i];
        const currElem = step.getHeapVariables()[i];
        if (prevElem.getId() !== currElem.getId() || prevElem.isFree() !== currElem.isFree()) {
          VisualizationTool.clearHeapRegisteredComponents();
          this.props.trace.prevVisualizedIndex = this.props.trace.traceIndex;
          break;
        }
      }
    }
  }

  getHeapVariableNodes() {
    const step = this.props.trace.getCurrentStep();
    return step.getHeapVariables().map(v => {
      const id = v.getId();
      return {
        ...VisualizationTool.getVariableCardDimensions(v),
        component: <VariableCard key={id} variable={v} traceStep={step} updateVisualization={this.updateVisualization}/>
      };
    });
  }

  getGlobalVariableNodes() {
    const step = this.props.trace.getCurrentStep();
    return step.getGlobalVariables().map(v => {
      const id = v.getId();
      return {
        ...VisualizationTool.getVariableCardDimensions(v),
        component: <VariableCard key={id} variable={v} traceStep={step}
                                 updateVisualization={this.updateVisualization} global/>
      };
    });
  }

  getStackFrameNodes() {
    const currentStep = this.props.trace.getCurrentStep();
    return currentStep.stack.map(frame => {
      const active = frame === currentStep.getCurrentStackFrame();
      VisualizationTool.updateStackFrameActiveness(frame, active);
      const dimensions = VisualizationTool.getStackFrameCardDimensions(frame, active);
      return {
        ...dimensions,
        component: <StackFrameCard key={frame.toString()} traceStep={currentStep} stackFrame={frame} active={active}
                                   updateVisualization={this.updateVisualization}/>
      };
    });
  }

  getStackNodes() {
    const stackNodes = [...this.getGlobalVariableNodes(), ...this.getStackFrameNodes()];
    return VisualizationTool.layoutNodes({
      nodes: stackNodes,
      origin: { x: 10, y: 40 },
      offset: { x: 0, y: 10 },
      traceStep: this.props.trace.getCurrentStep(),
      layout: VisualizationTool.Layouts.COLUMN
    }).reverse();
  }

  getHeapNodes() {
    return VisualizationTool.layoutNodes({
      nodes: this.getHeapVariableNodes(),
      origin: { x: (this.props.width / 2.0) + 10, y: 40 },
      offset: { x: 0, y: 10 },
      traceStep: this.props.trace.getCurrentStep(),
      layout: VisualizationTool.Layouts.COLUMN
    }).reverse();
  }

  getAllNodes() {
    // note that order is important here, we need heap nodes to be registered first
    const toReturn = [...this.getHeapNodes(), ...this.getStackNodes()];
    return toReturn;
  }

  getEmptyVisualization() {
    const height = this.props.height - VisualConstants.PADDING;
    return (
      <div className="visualization" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard splitTitle height={height} title="Stack" secondTitle="Heap"
                 bodyStyle={{ width: this.props.width, height }}/>
      </div>
    );
  }

  render() {
    const height = this.props.height - VisualConstants.PADDING;
    if (!this.props.trace) return this.getEmptyVisualization();
    return (
      <div className="visualization" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard splitTitle height={height} title="Stack" secondTitle="Heap"
                 bodyStyle={{ width: this.props.width, height }}>
          <Stage draggable width={this.props.width - VisualConstants.KONVA_PADDING}
                 height={height - VisualConstants.KONVA_PADDING}>
            <Layer>
              {!this.props.trace.encounteredException() && this.getAllNodes()}
            </Layer>
          </Stage>
        </DomCard>
      </div>
    );
  }
}
