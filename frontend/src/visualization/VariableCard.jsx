import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group } from "react-konva";

import VisualizationTool from "../utils/VisualizationTool";

export default class VariableCard extends Component {
  static get propTypes() {
    return {
      variable: PropTypes.object,
      x: PropTypes.number,
      y: PropTypes.number,
      nameFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      valueFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };
  }

  static get defaultProps() {
    return {
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
    this.state = { ...VisualizationTool.getVariableCardDimensions(this.props.variable) };
  }

  componentWillReceiveProps({ variable }) {
    this.setState({ ...VisualizationTool.getVariableCardDimensions(variable) });
  }

  getOutline() {
    return (
      <Rect
        x={this.props.x}
        y={this.props.y}
        width={this.state.width}
        height={this.state.height}
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
          width={this.state.width}
          height={this.state.height - 30}
          fill={VariableCard.TypeColors[this.props.variable.type]}
          cornerRadius={15}
        />
        <Rect
          x={this.props.x}
          y={this.props.y + 10}
          width={this.state.width}
          height={this.state.height - 40}
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

  getValueText() {
    return (
      <Text
        text={this.props.variable.getValue().toString()}
        x={this.props.x}
        y={this.props.y + 23}
        fontSize={this.props.valueFontSize}
        align="center"
        fontFamily="Menlo"
        width={this.state.width}
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
