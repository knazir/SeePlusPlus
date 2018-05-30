import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group } from "react-konva";

import VariableCard from "./VariableCard";
import VisualizationTool from "../utils/VisualizationTool";
import { StackFrameCard as VisualConstants } from "../utils/VisualConstants";

export default class StackFrameCard extends Component {
  static get propTypes() {
    return {
      trace: PropTypes.object.isRequired,
      traceStep: PropTypes.object.isRequired,
      stackFrame: PropTypes.object.isRequired,
      updateVisualization: PropTypes.func.isRequired,
      x: PropTypes.number,
      y: PropTypes.number
    };
  }

  constructor(props) {
    super(props);
    this.state = {
      ...VisualizationTool.getStackFrameCardDimensions(this.props.stackFrame)
    };
  }

  //////////// React Lifecycle ////////////

  componentWillReceiveProps({ stackFrame }) {
    this.setState({ ...VisualizationTool.getStackFrameCardDimensions(stackFrame) });
  }

  //////////// State Management ////////////

  toggleOpen() {
    this.props.trace.setStackFrameExpanded(this.props.stackFrame, !this.props.stackFrame.expanded);
    this.setState({ ...VisualizationTool.getStackFrameCardDimensions(this.props.stackFrame) }, () => {
      VisualizationTool.clearRegisteredComponents();
      this.props.updateVisualization();
    });
  }

  //////////// DOM Elements ////////////

  getOutline() {
    return (
      <Rect
        x={this.props.x}
        y={this.props.y}
        width={this.state.width}
        height={this.state.height}
        fill={VisualConstants.COLORS.BODY}
        stroke={VisualizationTool.getColor(this)}
        strokeWidth={VisualConstants.SIZING.OUTLINE_WIDTH}
        cornerRadius={VisualConstants.SIZING.CORNER_RADIUS}
      />
    );
  }

  getTitleBackground() {
    return (
      <Group>
        <Rect
          x={this.props.x}
          y={this.props.y}
          width={this.state.width}
          height={VisualConstants.SIZING.RECT_UPPER_HEIGHT}
          fill={VisualizationTool.getColor(this)}
          cornerRadius={VisualConstants.SIZING.CORNER_RADIUS}
        />
        <Rect
          x={this.props.x}
          y={this.props.y + 10}
          width={this.state.width}
          height={VisualConstants.SIZING.RECT_LOWER_HEIGHT}
          fill={VisualizationTool.getColor(this)}
        />
      </Group>
    );
  }

  getTitleText() {
    return (
      <Text
        text={this.props.stackFrame.getFuncName()}
        x={this.props.x}
        y={this.props.y + 3}
        fontSize={VisualConstants.FONT.TITLE_SIZE}
        fontFamily={VisualConstants.FONT.FAMILY}
        align={VisualConstants.ALIGNMENT.TITLE}
        width={this.state.width}
        onClick={() => this.toggleOpen()}
      />
    );
  }

  getTitleSegment() {
    return (
      <Group>
        {this.getTitleBackground()}
        {this.getTitleText()}
      </Group>
    );
  }

  getLocalVariableNodes() {
    const nodesToLayout = this.props.stackFrame.getLocalVariables().map(v => {
      return {
        ...VisualizationTool.getVariableCardDimensions(v),
        component: <VariableCard key={v.getId()} variable={v} traceStep={this.props.traceStep} x={this.props.x + 35}
                                 y={this.props.y + VisualConstants.SIZING.ORIGIN_Y_OFFSET}
                                 updateVisualization={this.props.updateVisualization}/>
      };
    });
    return VisualizationTool.layoutNodes({
      nodes: nodesToLayout,
      origin: { x: this.props.x + 7, y: this.props.y + VisualConstants.SIZING.ORIGIN_Y_OFFSET },
      offset: { x: 0, y: VisualConstants.SIZING.OFFSET },
      traceStep: this.props.traceStep,
      layout: VisualizationTool.Layouts.COLUMN
    });
  }

  render() {
    return (
      <Group>
        {this.getOutline()}
        {this.getTitleSegment()}
        {this.props.stackFrame.expanded && this.getLocalVariableNodes()}
      </Group>
    );
  }
}
