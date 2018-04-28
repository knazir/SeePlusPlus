import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group } from "react-konva";

import VariableCard from "./VariableCard";
import VisualizationTool from "../utils/VisualizationTool";

export default class StackFrameCard extends Component {
  static get propTypes() {
    return {
      stackFrame: PropTypes.object,
      active: PropTypes.bool,
      x: PropTypes.number,
      y: PropTypes.number,
    };
  }

  constructor(props) {
    super(props);
    this.state = { ...VisualizationTool.getStackFrameCardDimensions(this.props.stackFrame) }
  }

  componentWillReceiveProps(newProps) {
    this.setState({ ...VisualizationTool.getStackFrameCardDimensions(newProps.stackFrame) });
  }

  getColor() {
    return this.props.active ? "rgb(210,255,139)" : "rgb(197, 204, 216)";
  }

  getOutline() {
    return (
      <Rect
        x={this.props.x}
        y={this.props.y}
        width={this.state.width}
        height={this.state.height}
        fill="white"
        stroke={this.getColor()}
        strokeWidth={2}
        cornerRadius={15}
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
          height={30}
          fill={this.getColor()}
          cornerRadius={15}
        />
        <Rect
          x={this.props.x}
          y={this.props.y + 10}
          width={this.state.width}
          height={20}
          fill={this.getColor()}
        />
      </Group>
    );
  }

  getTitleText() {
    return (
      <Text
        text={this.props.stackFrame.funcName}
        x={this.props.x}
        y={this.props.y + 3}
        fontSize={20}
        fontFamily="Menlo"
        align="center"
        width={this.state.width}
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
    return this.props.stackFrame.getLocalVariables().map(v => {
      return <VariableCard key={v.name} variable={v} x={this.props.x + 40} y={this.props.y + 40}/>;
    });
  }

  render() {
    return (
      <Group draggable>
        {this.getOutline()}
        {this.getTitleSegment()}
        {this.getLocalVariableNodes()}
      </Group>
    );
  }
}
