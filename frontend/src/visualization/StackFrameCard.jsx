import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group } from "react-konva";

import VariableCard from "./VariableCard";

export default class StackFrameCard extends Component {
  static get propTypes() {
    return {
      stackFrame: PropTypes.object,
      active: PropTypes.bool,
      x: PropTypes.number,
      y: PropTypes.number,
      height: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };
  }

  static get defaultProps() {
    return {
      height: 250
    };
  }

  constructor(props) {
    super(props);
    this.state = { frameWidth: this.calculateFrameWidth(props) };
  }

  componentWillReceiveProps(newProps) {
    this.setState({ frameWidth: this.calculateFrameWidth(newProps) });
  }

  calculateFrameWidth({ stackFrame }) {
    return Math.max(stackFrame.funcName.length * 2, 20) * 20;
  }

  getColor() {
    return this.props.active ? "rgb(210,255,139)" : "rgb(197, 204, 216)";
  }

  getOutline() {
    return (
      <Rect
        x={this.props.x}
        y={this.props.y}
        width={this.state.frameWidth}
        height={this.props.height}
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
          width={this.state.frameWidth}
          height={30}
          fill={this.getColor()}
          cornerRadius={15}
        />
        <Rect
          x={this.props.x}
          y={this.props.y + 10}
          width={this.state.frameWidth}
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
        width={this.state.frameWidth}
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
