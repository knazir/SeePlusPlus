import React, { Component } from "react";
import PropTypes from "prop-types";
import { Layer, Rect, Text, Group } from "react-konva";

export default class VariableCard extends Component {
  static get propTypes() {
    return {
      name: PropTypes.string,
      val: PropTypes.string,
      type: PropTypes.string,
      x: PropTypes.number,
      y: PropTypes.number,
      height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      nameFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      valFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };
  }

  static get defaultProps() {
    return {
      height: 50,
      nameFontSize: 15,
      valFontSize: 25
    };
  }

  static get TypeColors() {
    return {
      "char": "rgb(127, 255, 127)",
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

  calculateFrameWidth(props) {
    const { type, name, val } = props;
    return Math.max(type.length + name.length + 1, val.length * 2, 5) * 10;
  }

  render() {
    return (
      <Layer>
        <Group draggable>
          <Rect
            x={this.props.x}
            y={this.props.y}
            width={this.state.frameWidth}
            height={this.props.height}
            fill="white"
            stroke={VariableCard.TypeColors[this.props.type]}
            strokeWidth={2}
            cornerRadius={15}
          />
          <Rect
            x={this.props.x}
            y={this.props.y}
            width={this.state.frameWidth}
            height={this.props.height - 30}
            fill={VariableCard.TypeColors[this.props.type]}
            cornerRadius={15}
          />
          <Rect
            x={this.props.x}
            y={this.props.y + 10}
            width={this.state.frameWidth}
            height={this.props.height - 40}
            fill={VariableCard.TypeColors[this.props.type]}
          />
          <Text
            text={`${this.props.type} ${this.props.name}`}
            x={this.props.x}
            y={this.props.y + 3}
            fontSize={this.props.nameFontSize}
            fontFamily="Menlo"
            align="center"
            width={this.state.frameWidth}
          />
          <Text
            text={this.props.val}
            x={this.props.x}
            y={this.props.y + 23}
            fontSize={this.props.valFontSize}
            align="center"
            fontFamily="Menlo"
            width={this.state.frameWidth}
          />
        </Group>
      </Layer>
    );
  }
}
