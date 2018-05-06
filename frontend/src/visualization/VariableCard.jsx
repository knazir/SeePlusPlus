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
      pointerTarget: PropTypes.shape({
        props: PropTypes.shape({
          x: PropTypes.number,
          y: PropTypes.number,
          variable: PropTypes.object
        })
      }),
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
      const origin = { x: this.props.x + this.state.width / 2.0, y: this.props.y + VisualConstants.POINTER.Y_OFFSET };
      const targetProps = this.props.pointerTarget.props;
      const targetDimensions = VisualizationTool.getVariableCardDimensions(targetProps.variable);
      const targetX = targetProps.x;
      const targetY = targetProps.y + targetDimensions.centerOffset;
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

  getStructValues() {
    const { ROW, COLUMN } = VisualizationTool.Layouts;
    const nodesToLayout = Object.values(this.props.variable.value).map(v => {
      const { width, height } = VisualizationTool.getVariableCardDimensions(v);
      const component = <VariableCard key={v.name} variable={v} traceStep={this.props.traceStep} x={this.props.x + 40}
                                      y={this.props.y + 40} updateVisualization={this.props.updateVisualization}/>;
      return { width, height, component };
    });
    return VisualizationTool.layoutNodes({
      nodes: nodesToLayout,
      origin: { x: this.props.x + 7, y: this.props.y + 25 },
      offset: this.props.variable.cType === Variable.CTypes.STRUCT_ARRAY ? { x: 15, y: 0 } : { x: 0, y: 15 },
      traceStep: this.props.traceStep,
      layout: this.props.variable.cType === Variable.CTypes.STRUCT_ARRAY ? ROW : COLUMN
    });
  }

  render() {
    const cType = this.props.variable.cType;
    const isComplexVar = cType === Variable.CTypes.STRUCT || cType === Variable.CTypes.STRUCT_ARRAY;
    return (
      <Group draggable onDragMove={this.props.updateVisualization}>
        {this.getOutline()}
        {this.getTitleSegment()}
        {isComplexVar ? this.getStructValues() : this.getPrimitiveValue()}
      </Group>
    );
  }
}
