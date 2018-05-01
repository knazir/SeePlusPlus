import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group, Arrow, Circle } from "react-konva";

import Variable from "../models/Variable";
import VisualizationTool from "../utils/VisualizationTool";
import { VariableCard as VisualConstants } from "../utils/VisualConstants";

export default class VariableCard extends Component {
  static get propTypes() {
    return {
      variable: PropTypes.object,
      x: PropTypes.number,
      y: PropTypes.number
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
          height={20}
          fill={VisualizationTool.getColor(this)}
          cornerRadius={VisualConstants.SIZING.CORNER_RADIUS}
        />
        <Rect
          x={this.props.x}
          y={this.props.y + 10}
          width={this.state.width}
          height={10}
          fill={VisualizationTool.getColor(this)}
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
        fontSize={VisualConstants.FONT.TITLE_SIZE}
        fontFamily={VisualConstants.FONT.FAMILY}
        align={VisualConstants.ALIGNMENT.TITLE}
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

  getPrimitiveValue() {
    console.log(this.props.type);
    if(!this.props.variable.isPointer() | this.props.variable.isUninitialized()){
      return (
            <Text
                text={this.props.variable.getValue().toString()}
                x={this.props.x}
                y={this.props.y + 23}
                fontSize={VisualConstants.FONT.BODY_SIZE}
                align={VisualConstants.ALIGNMENT.VALUE}
                fontFamily={VisualConstants.FONT.FAMILY}
                width={this.state.width}
            />
        );
    }
    else {
      const origin = {x: this.props.x + this.state.width/2.0, y: this.props.y + VisualConstants.POINTER.Y_OFFSET}
      return (
          <Group>
            <Circle
                x={origin.x}
                y={origin.y}
                radius={VisualConstants.POINTER.RADIUS}
                fill={VisualConstants.POINTER.COLOR}
            />
            <Arrow
              points={[origin.x, origin.y, origin.x + 40, origin.y]}
              stroke={VisualConstants.POINTER.COLOR}
              tension={VisualConstants.POINTER.TENSION}
              pointerLength={VisualConstants.POINTER.LENGTH}
              pointerWidth ={VisualConstants.POINTER.WIDTH}
              fill={VisualConstants.POINTER.COLOR}
            />
          </Group>
      );
    }
  }

  getStructValues() {
    const origin = { x: this.props.x + 7, y: this.props.y + 25 };
    const offset = { x: 0, y: 15 };
    const nodesToLayout = Object.values(this.props.variable.value).map(v => {
      const { width, height } = VisualizationTool.getVariableCardDimensions(v);
      const component = <VariableCard key={v.name} variable={v} x={this.props.x + 40} y={this.props.y + 40}/>;
      return { width, height, component };
    });
    return VisualizationTool.layoutNodes(nodesToLayout, origin, offset, VisualizationTool.Layouts.COLUMN);
  }

  render() {
    return (
      <Group draggable>
        {this.getOutline()}
        {this.getTitleSegment()}
        {this.props.variable.cType === Variable.CTypes.STRUCT ? this.getStructValues() : this.getPrimitiveValue()}
      </Group>
    );
  }
}
