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
    this.handleStageDrag = this.handleStageDrag.bind(this);
    this.onResize = this.onResize.bind(this);
  }

  //////////// React Lifecycle ////////////

  componentWillMount() {
    window.addEventListener("resize", this.onResize);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.onResize);
  }

  //////////// Event Handling ////////////

  onResize(event) {
    event.stopPropagation();
    VisualizationTool.clearArrowComponents();
    this.updateVisualization();
  }

  //////////// Visualization ////////////

  updateVisualization() {
    this.forceUpdate();
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
      return {
        ...VisualizationTool.getStackFrameCardDimensions(frame, frame.active),
        component: <StackFrameCard key={frame.toString()} trace={this.props.trace} traceStep={currentStep}
                                   stackFrame={frame} updateVisualization={this.updateVisualization}/>
      };
    });
  }

  getStackNodes() {
    const stackNodes = [...this.getGlobalVariableNodes(), ...this.getStackFrameNodes()];
    return VisualizationTool.layoutNodes({
      nodes: stackNodes,
      origin: { x: 10, y: 10 },
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
    if (this.props.trace.getCurrentStep().heap) {
      // note that order is important here, we need heap nodes to be registered first
      return [...this.getHeapNodes(), ...this.getStackNodes(), ...VisualizationTool.getArrowComponents()];
    }
    return [];
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

  handleStageDrag(pos) {
    return { x: 0, y: pos.y };
  }

  render() {
    const height = this.props.height - VisualConstants.PADDING;
    if (!this.props.trace) return this.getEmptyVisualization();
    return (
      <div className="visualization" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard splitTitle height={height} title="Stack" secondTitle="Heap"
                 bodyStyle={{ width: this.props.width, height }}>
          <Stage draggable dragBoundFunc={this.handleStageDrag} width={this.props.width - VisualConstants.KONVA_PADDING}
                 height={height - VisualConstants.KONVA_PADDING}>
            <Layer>
              {this.getAllNodes()}
            </Layer>
          </Stage>
        </DomCard>
      </div>
    );
  }
}
