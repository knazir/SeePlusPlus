import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group, Arrow, Circle } from "react-konva";

import Variable from "../models/Variable";
import VisualizationTool from "../utils/VisualizationTool";
import { VariableCard as VisualConstants } from "../utils/VisualConstants";

export default class VariableCard extends Component {
  static get propTypes() {
    return {
      traceStep: PropTypes.object.isRequired,
      variable: PropTypes.object.isRequired,
      updateVisualization: PropTypes.func.isRequired,
      x: PropTypes.number,
      y: PropTypes.number,
      squareCorners: PropTypes.bool
    };
  }

  static get defaultProps() {
    return { squareCorners: false };
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
        cornerRadius={this.props.squareCorners ? 0 : VisualConstants.SIZING.CORNER_RADIUS}
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
          cornerRadius={this.props.squareCorners ? 0 : VisualConstants.SIZING.CORNER_RADIUS}
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
    if (!this.props.variable.isPointer() || this.props.variable.isUninitialized()) {
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
    } else {
      // TODO kn: Figure out dragging for pointer origin
      const origin = { x: this.props.x + this.state.width / 2.0, y: this.props.y + VisualConstants.POINTER.Y_OFFSET };
      let targetX = origin.x + 10;
      let targetY = origin.y;
      const pointerTarget = VisualizationTool.getComponentByAddress(this.props.variable.getValue());
      if (pointerTarget) {
        const { x, y, variable } = pointerTarget;
        const targetDimensions = VisualizationTool.getVariableCardDimensions(variable);
        targetX = x;
        targetY = y + targetDimensions.centerOffset;
      }

      return (
        <Group>
          <Circle
            x={origin.x}
            y={origin.y}
            radius={VisualConstants.POINTER.RADIUS}
            fill={VisualConstants.POINTER.COLOR}
          />
          <Arrow
            points={[origin.x, origin.y, targetX, targetY]}
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

  updatePosition(event) {
    if (!event) return;
    VisualizationTool.getComponentByAddress(this.props.variable.address).x = this.props.x + event.target.x();
    VisualizationTool.getComponentByAddress(this.props.variable.address).y = this.props.y + event.target.y();
    this.props.updateVisualization();
  }

  getStructValues() {
    const { ROW, COLUMN } = VisualizationTool.Layouts;
    const nodesToLayout = Object.values(this.props.variable.value).map(v => {
      const { width, height } = VisualizationTool.getVariableCardDimensions(v);
      const component = <VariableCard key={v.name} variable={v} traceStep={this.props.traceStep} x={this.props.x + 40}
                                      y={this.props.y + 40} updateVisualization={this.props.updateVisualization}
                                      squareCorners={this.props.variable.isArray()}/>;
      return { width, height, component };
    });
    return VisualizationTool.layoutNodes({
      nodes: nodesToLayout,
      origin: { x: this.props.x + 7, y: this.props.y + 25 },
      offset: this.props.variable.cType === Variable.CTypes.STRUCT_ARRAY ? { x: 0, y: 0 } : { x: 0, y: 15 },
      traceStep: this.props.traceStep,
      layout: this.props.variable.cType === Variable.CTypes.STRUCT_ARRAY ? ROW : COLUMN
    });
  }

  render() {
    const cType = this.props.variable.cType;
    const isComplexVar = cType === Variable.CTypes.STRUCT || cType === Variable.CTypes.STRUCT_ARRAY;
    return (
      <Group draggable onDragMove={event => this.updatePosition(event)}>
        {this.getOutline()}
        {this.getTitleSegment()}
        {isComplexVar ? this.getStructValues() : this.getPrimitiveValue()}
      </Group>
    );
  }
}
