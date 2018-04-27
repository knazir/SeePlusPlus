import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group } from "react-konva";

export default class VariableCard extends Component {
  static get propTypes() {
    return {
      variable: PropTypes.object,
      x: PropTypes.number,
      y: PropTypes.number,
      height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      nameFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      valueFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };
  }

  static get defaultProps() {
    return {
      height: 50,
      nameFontSize: 15,
      valueFontSize: 25
    };
  }

  static get TypeColors() {
    return {
      "char": "rgb(106, 247, 127)",
      "int": "rgb(255,127,127)",
      "string": "rgb(255,228,129)",
      "double": "rgb(210,255,139)",
      "pointer": "rgb(165,209,255)",
      "bool": "rgb(227,156,255)"
    };
  }

  constructor(props) {
    super(props);
    this.state = { frameWidth: this.calculateFrameWidth(props) };
  }

  componentWillReceiveProps(newProps) {
    this.setState({ frameWidth: this.calculateFrameWidth(newProps) });
  }

  calculateFrameWidth({ variable }) {
    const { type, name } = variable;
    return Math.max(type.length + name.length + 2, variable.getValue().toString().length * 2 + 2, 5) * 10;
  }

  getOutline() {
    return (
      <Rect
        x={this.props.x}
        y={this.props.y}
        width={this.state.frameWidth}
        height={this.props.height}
        fill="white"
        stroke={VariableCard.TypeColors[this.props.variable.type]}
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
          height={this.props.height - 30}
          fill={VariableCard.TypeColors[this.props.variable.type]}
          cornerRadius={15}
        />
        <Rect
          x={this.props.x}
          y={this.props.y + 10}
          width={this.state.frameWidth}
          height={this.props.height - 40}
          fill={VariableCard.TypeColors[this.props.variable.type]}
        />
      </Group>
    );
  }

  getTitleText() {
    return (
      <Text
        text={this.props.variable.toString()}
        x={this.props.x}
        y={this.props.y + 3}
        fontSize={this.props.nameFontSize}
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

  getValueText() {
    return (
      <Text
        text={this.props.variable.getValue().toString()}
        x={this.props.x}
        y={this.props.y + 23}
        fontSize={this.props.valueFontSize}
        align="center"
        fontFamily="Menlo"
        width={this.state.frameWidth}
      />
    );
  }

  render() {
    return (
      <Group draggable>
        {this.getOutline()}
        {this.getTitleSegment()}
        {this.getValueText()}
      </Group>
    );
  }
}
