import React, { Component } from "react";
import PropTypes from "prop-types";
import { Layer, Line, Stage, Text } from "react-konva";

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
      trace: PropTypes.object,
      updateVisualization: PropTypes.func.isRequired
    };
  }

  constructor(props) {
    super(props);
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
    VisualizationTool.clearAllArrowComponents();
    this.props.updateVisualization();
  }

  //////////// Visualization ////////////

  getHeapVariableNodes() {
    const step = this.props.trace.getCurrentStep();
    return step.getHeapVariables().map(v => {
      const id = v.getId();
      return {
        ...VisualizationTool.getVariableCardDimensions(v),
        component: <VariableCard key={id} variable={v} traceStep={step} updateVisualization={this.props.updateVisualization}/>
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
                                 updateVisualization={this.props.updateVisualization} global/>
      };
    });
  }

  getStackFrameNodes() {
    const currentStep = this.props.trace.getCurrentStep();
    return currentStep.stack.map(frame => {
      return {
        ...VisualizationTool.getStackFrameCardDimensions(frame, frame.active),
        component: <StackFrameCard key={frame.toString()} trace={this.props.trace} traceStep={currentStep}
                                   stackFrame={frame} updateVisualization={this.props.updateVisualization}/>
      };
    });
  }

  getStackNodes() {
    const stackNodes = [...this.getGlobalVariableNodes(), ...this.getStackFrameNodes()];
    return VisualizationTool.layoutNodes({
      nodes: stackNodes,
      origin: { x: 10, y: VisualConstants.STAGE_Y_OFFSET },
      offset: { x: 0, y: 10 },
      layout: VisualizationTool.Layouts.COLUMN
    }).reverse();
  }

  getHeapNodes() {
    return VisualizationTool.layoutHeap({
      nodes: this.getHeapVariableNodes(),
      origin: { x: (this.props.width / 2.0) + 10, y: VisualConstants.STAGE_Y_OFFSET }
    });
  }

  getAllNodes() {
    if (!this.props.trace.getCurrentStep().heap) return [];
    // note that order is important here, we need heap nodes to be registered first
    return [...this.getHeapNodes(), ...this.getStackNodes(), ...VisualizationTool.getArrowComponents()];
  }

  getSplitLine() {
    return (
      <Line
        points={[this.props.width / 2.0, Number.MIN_SAFE_INTEGER, this.props.width / 2.0, Number.MAX_SAFE_INTEGER]}
        stroke={VisualConstants.SPLIT_LINE.COLOR}
        fill={VisualConstants.SPLIT_LINE.COLOR}
        strokeWidth={VisualConstants.SPLIT_LINE.WIDTH}
      />
    );
  }

  getTitleLayer() {
    return (
      <Layer key="title">
        <Line
          points={[Number.MIN_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER, 0]}
          stroke={VisualConstants.SPLIT_LINE.COLOR}
          fill={VisualConstants.SPLIT_LINE.COLOR}
          strokeWidth={VisualConstants.SPLIT_LINE.WIDTH}
        />
        <Text
          text="Stack"
          x={0}
          y={VisualConstants.TITLE_Y_OFFSET}
          fontSize={VisualConstants.FONT.SIZE}
          fontFamily={VisualConstants.FONT.FAMILY}
          fontStyle={VisualConstants.FONT.STYLE}
          align={VisualConstants.FONT.ALIGNMENT}
          width={this.props.width / 2.0}
        />
        <Text
          text="Heap"
          x={this.props.width / 2.0}
          y={VisualConstants.TITLE_Y_OFFSET}
          fontSize={VisualConstants.FONT.SIZE}
          fontFamily={VisualConstants.FONT.FAMILY}
          fontStyle={VisualConstants.FONT.STYLE}
          align={VisualConstants.FONT.ALIGNMENT}
          width={this.props.width / 2.0}
        />
        <Line
          points={[Number.MIN_SAFE_INTEGER, VisualConstants.TITLE_UNDERLINE_Y_OFFSET,
            Number.MAX_SAFE_INTEGER, VisualConstants.TITLE_UNDERLINE_Y_OFFSET]}
          stroke={VisualConstants.SPLIT_LINE.COLOR}
          fill={VisualConstants.SPLIT_LINE.COLOR}
          strokeWidth={VisualConstants.SPLIT_LINE.WIDTH}
        />
      </Layer>
    );
  }

  getStageBody() {
    let layers = [<Layer key="split">{this.getSplitLine()}</Layer>, this.getTitleLayer()];
    if (this.props.trace) layers.push(<Layer key="nodes">{this.getAllNodes()}</Layer>);
    return layers;
  }

  getVisualizationBody(height) {
    const bodyWidth = this.props.width - VisualConstants.KONVA_PADDING;
    const bodyHeight = height - VisualConstants.KONVA_PADDING;
    return (
      <Stage draggable={this.props.trace} dragBoundFunc={this.handleStageDrag} width={bodyWidth} height={bodyHeight}>
        {this.getStageBody()}
      </Stage>
    );
  }

  handleStageDrag({ x, y }) {
    const result = { x, y };
    if (x > 0) result.x = 0;
    if (y > 0) result.y = 0;
    return result;
  }

  render() {
    const height = this.props.height - VisualConstants.PADDING;
    return (
      <div className="visualization" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard height={height} title="Visualization" bodyStyle={{ width: this.props.width, height }}>
          {this.getVisualizationBody(height)}
        </DomCard>
      </div>
    );
  }
}
