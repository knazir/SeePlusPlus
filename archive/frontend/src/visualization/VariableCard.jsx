import React, { Component } from "react";
import PropTypes from "prop-types";
import { Rect, Text, Group, Arrow, Circle, Line } from "react-konva";

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

  //////////// React Lifecycle ////////////

  componentWillReceiveProps({ variable }) {
    this.setState({
      highlight: variable.getValue() !== this.props.variable.getValue(),
      prevHighlight: this.state.highlight,
      ...VisualizationTool.getVariableCardDimensions(variable)
    });
  }

  //////////// Visualization Logic ////////////

  getPointerIntermediateXCoordinate(originX, targetX) {
    let padding = ((originX - (this.state.width + VisualConstants.POINTER.INTERMEDIATE_PADDING) / 2.0)) > 0 ? VisualConstants.POINTER.INTERMEDIATE_PADDING : 0;
    let length = Math.max(Math.abs((originX - targetX) / 2.0), (this.state.width + padding) / 2.0);
    return targetX > originX ? originX + length : originX - length;
  }

  getPointerLinePoints(origin, pointerTarget) {
    let isInTree = ((VisualizationTool.componentsByAddress[this.props.variable.parent.address]).component.props.variable).isTree();
    let targetX = isInTree ? origin.x + this.state.width / 2.0 : origin.x + 10;
    let targetY = origin.y;
    let points = [];
    if (pointerTarget) {
      const { x, y } = pointerTarget;
      const withinThreshold = Math.abs(y - origin.y) < VisualConstants.POINTER.THRESHOLD_SUPER_CLOSE_Y &&
        Math.abs(x - origin.x) < VisualConstants.POINTER.THRESHOLD_SUPER_CLOSE_X;
      const withinTargetBoundaries = origin.x >= x;
      if (withinThreshold && withinTargetBoundaries && !isInTree) {
        targetX = origin.x;
        targetY = y + VisualConstants.POINTER.ARROW_OFFSET;
        points = [origin.x, origin.y - VisualConstants.POINTER.ORIGIN_Y_SHIFTER, targetX, targetY];
      } else if (isInTree) {
        targetX = x + this.state.width;
        targetY = y + VisualConstants.POINTER.ARROW_OFFSET;
        points = [origin.x, origin.y - VisualConstants.POINTER.ORIGIN_Y_SHIFTER, targetX, targetY];
      } else {
        targetX = x + VisualConstants.POINTER.ARROW_OFFSET;
        targetY = y + VisualConstants.POINTER.ARROW_OFFSET;
        points = [origin.x, origin.y - VisualConstants.POINTER.ORIGIN_Y_SHIFTER, this.getPointerIntermediateXCoordinate(origin.x, targetX), origin.y - VisualConstants.POINTER.ORIGIN_Y_SHIFTER, targetX, targetY];
      }
    }
    return points;
  }

  //////////// DOM Elements ////////////

  getOutline() {
    return (
      <Rect
        x={this.props.x}
        y={this.props.y}
        width={this.state.width}
        height={this.state.height}
        fill={this.props.variable.isReference() ? VisualConstants.COLORS.REF_BODY : VisualConstants.COLORS.BODY}
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
          height={VisualConstants.SIZING.TITLE_HEIGHT}
          fill={VisualizationTool.getColor(this)}
          cornerRadius={this.props.squareCorners ? 0 : VisualConstants.SIZING.CORNER_RADIUS}
        />
        <Rect
          x={this.props.x}
          y={this.props.y + 10}
          width={this.state.width}
          height={VisualConstants.SIZING.TITLE_UPPER_RECT_HEIGHT}
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

  getValueText() {
    return (
      <Text
        text={this.props.variable.getValue().toString()}
        x={this.props.x}
        y={this.props.y + 23}
        fontSize={VisualConstants.FONT.BODY_SIZE}
        align={VisualConstants.ALIGNMENT.VALUE}
        fontFamily={VisualConstants.FONT.FAMILY}
        fontStyle={this.state.prevHighlight ? "bold" : "normal"}
        width={this.state.width}
      />
    );
  }

  getPointerToTarget(origin, pointerTarget) {
    const points = this.getPointerLinePoints(origin, pointerTarget);
    const arrowComponent = (
      <Arrow
        points={points}
        stroke={VisualConstants.POINTER.COLOR}
        strokeWidth={this.state.highlight ? VisualConstants.POINTER.BOLD_WIDTH : VisualConstants.POINTER.NORMAL_WIDTH}
        tension={VisualConstants.POINTER.TENSION}
        pointerLength={VisualConstants.POINTER.LENGTH}
        pointerWidth ={VisualConstants.POINTER.WIDTH}
        fill={VisualConstants.POINTER.COLOR}
      />
    );
    VisualizationTool.registerArrowComponent(this.props.variable, arrowComponent);
    return (
      <Group key={this.props.variable.toString() + this.props.variable.address}>
        <Circle
          x={origin.x}
          y={origin.y - VisualConstants.POINTER.ORIGIN_Y_SHIFTER}
          radius={VisualConstants.POINTER.RADIUS}
          fill={VisualConstants.POINTER.COLOR}
        />
      </Group>
    );
  }

  getNullIndicator(origin) {
    const contentHeight = this.state.height - VisualConstants.SIZING.TITLE_HEIGHT;
    return (
      <Line
        points={[
          origin.x + this.state.width / 2.0,
          origin.y - contentHeight / 2.0,
          origin.x - this.state.width / 2.0 + 1.5 * VisualConstants.SIZING.ROUNDED_PADDING,
          origin.y + contentHeight / 2.0 - VisualConstants.SIZING.ROUNDED_PADDING
        ]}
        stroke={VisualConstants.POINTER.COLOR}
        strokeWidth={this.state.highlight ? VisualConstants.POINTER.BOLD_WIDTH : VisualConstants.POINTER.NORMAL_WIDTH}
        fill={VisualConstants.POINTER.COLOR}
      />
    );
  }

  getPrimitiveValue() {
    if (!this.props.variable.isPointer() || this.props.variable.isUninitialized()) return this.getValueText();
    const origin = { x: this.props.x + this.state.width / 2.0, y: this.props.y + VisualConstants.POINTER.Y_OFFSET };
    let pointerTarget = VisualizationTool.getComponentByAddress(this.props.variable.getValue());
    if (pointerTarget) {
      return this.getPointerToTarget(origin, pointerTarget);
    } else if (this.props.variable.target && this.props.variable.target.stackFrame) { // valid target, but not rendered
      pointerTarget = VisualizationTool.getStackFrameComponent(this.props.variable.target.stackFrame);
      return pointerTarget ? this.getPointerToTarget(origin, pointerTarget) : null;
    } else if (this.props.variable.isNull()) {
      return this.getNullIndicator(origin);
    } else { // could not find target but value is not null (garbage pointer?)
      return null;
    }
  }

  getStructValues() {
    if (this.props.variable.isMultiDimArray()) return this.getMultiDimValues();
    if (this.props.variable.isTree()) return this.getTreeValues();
    const { ROW, COLUMN } = VisualizationTool.Layouts;
    const nodesToLayout = Object.values(this.props.variable.value).map(v => {
      return {
        ...VisualizationTool.getVariableCardDimensions(v),
        component: <VariableCard key={v.getId()} variable={v} traceStep={this.props.traceStep} x={this.props.x + 40}
                                 y={this.props.y + 40} updateVisualization={this.props.updateVisualization}
                                 squareCorners={this.props.variable.isArray()}/>
      };
    });
    return VisualizationTool.layoutNodes({
      nodes: nodesToLayout,
      origin: { x: this.props.x, y: this.props.y + VisualConstants.SIZING.ORIGIN_Y_OFFSET },
      offset: this.props.variable.cType === Variable.CTypes.STRUCT_ARRAY ? { x: 0, y: 0 } : { x: 0, y: 10 },
      traceStep: this.props.traceStep,
      layout: this.props.variable.cType === Variable.CTypes.STRUCT_ARRAY ? ROW : COLUMN,
      componentWidth: this.state.width
    });
  }

  getTreeValues() {
    const nodesToLayout = Object.values(this.props.variable.value).map(v => {
      return {
        ...VisualizationTool.getVariableCardDimensions(v),
        component: <VariableCard key={v.getId()} variable={v} traceStep={this.props.traceStep} x={this.props.x + 40}
                                 y={this.props.y + 40} updateVisualization={this.props.updateVisualization}/>
      };
    });
    return VisualizationTool.layoutTreeNodes({
      nodes: nodesToLayout,
      origin: { x: this.props.x, y: this.props.y + VisualConstants.SIZING.ORIGIN_Y_OFFSET },
      offset: 10,
      traceStep: this.props.traceStep,
      componentWidth: this.state.width
    });
  }

  getMultiDimValues() {
    const value = this.props.variable.value;
    let nodesToLayout = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      let row = new Array(value[i].length);
      for (let j = 0; j < value[i].length; j++) {
        const v = value[i][j];
        row[j] = {
          ...VisualizationTool.getVariableCardDimensions(v),
          component: <VariableCard key={v.getId()} variable={v} traceStep={this.props.traceStep} x={this.props.x + 40}
                                   y={this.props.y + 40} updateVisualization={this.props.updateVisualization}
                                   squareCorners />
        };
      }
      nodesToLayout[i] = row;
    }
    return VisualizationTool.layoutMultiDimArrayNodes({
      nodes: nodesToLayout,
      origin: { x: this.props.x, y: this.props.y + VisualConstants.SIZING.ORIGIN_Y_OFFSET },
      offset: { x: 0, y: 0 },
      traceStep: this.props.traceStep,
      componentWidth: this.state.width
    });
  }

  render() {
    const variable = this.props.variable;
    return (
      <Group>
        {this.getOutline()}
        {this.getTitleSegment()}
        {variable.isComplexType() ? this.getStructValues() : this.getPrimitiveValue()}
      </Group>
    );
  }
}
