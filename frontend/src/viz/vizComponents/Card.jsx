import React, { Component } from "react";
import PropTypes from "prop-types";
import { Layer, Rect, Text, Group } from "react-konva";

class Card extends Component {
  static get propTypes() {
    return {
      type: PropTypes.string,
      name: PropTypes.string,
      val: PropTypes.string,
      x: PropTypes.number,
      y: PropTypes.number,
      height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      nameFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      valFontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
    };
  }

  constructor(props) {
    super(props);
    this.state = {
      frameWidth: Math.max(this.props.type.length, this.props.name.length, this.props.val.length * 1.5, 5) * 10,
      color: "white"
    };
  }

  render() {
    return (
      <Layer>
        <Group draggable>
          <Rect
            x={this.props.x}
            y={this.props.y}
            width={this.state.frameWidth}
            height={this.props.height || 50}
            fill={this.state.color}
            shadowBlur={5}
            onClick={this.handleClick}
            cornerRadius={15}
          />
          <Text
            text={`${this.props.type} ${this.props.name}`}
            x={this.props.x}
            y={this.props.y + 3}
            fontSize={this.props.nameFontSize || 15}
            align="center"
            width={this.state.frameWidth}
          />
          <Text
            text={this.props.val}
            x={this.props.x}
            y={this.props.y + 20}
            fontSize={this.props.valFontSize || 30}
            align="center"
            width={this.state.frameWidth}

          />
        </Group>
      </Layer>
    );
  }
}

export default Card;
