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

  componentWillReceiveProps({ variable }) {
    if (variable.getValue() !== this.props.variable.getValue()) {
      this.setState({ highlight: true, ...VisualizationTool.getVariableCardDimensions(variable) });
    } else {
      this.setState({ highlight: false, ...VisualizationTool.getVariableCardDimensions(variable) });
    }
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

  getPointerIntermediateXCoordinate(originX, targetX) {
    let length = Math.max(Math.abs((originX - targetX) / 2.0), (this.state.width + VisualConstants.POINTER.INTERMEDIATE_PADDING) / 2.0);
    return targetX > originX ? originX + length : originX - length;
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
          fontStyle={this.state.highlight ? "bold" : "normal"}
          width={this.state.width}
        />
      );
    } else {
      // TODO kn: Figure out dragging for pointer origin
      const origin = { x: this.props.x + this.state.width / 2.0, y: this.props.y + VisualConstants.POINTER.Y_OFFSET };
      let targetX = origin.x + 10;
      let targetY = origin.y;
      let points = [];
      const pointerTarget = VisualizationTool.getComponentByAddress(this.props.variable.getValue());
      if (pointerTarget) {
        const { x, y } = pointerTarget;
        if (Math.abs(y - origin.y) < VisualConstants.POINTER.THRESHOLD_SUPER_CLOSE_Y && Math.abs(x - origin.x) < VisualConstants.POINTER.THRESHOLD_SUPER_CLOSE_X) {
          targetX = origin.x;
          targetY = y + VisualConstants.POINTER.ARROW_OFFSET;
          points = [origin.x, origin.y, targetX, targetY];
        } else {
          targetX = x + VisualConstants.POINTER.ARROW_OFFSET;
          targetY = y + VisualConstants.POINTER.ARROW_OFFSET;
          points = [origin.x, origin.y, this.getPointerIntermediateXCoordinate(origin.x, targetX), origin.y, targetX, targetY];
        }
      } else if (this.props.variable.getValue() === "0x0") {
        let contentHeight = this.state.height - VisualConstants.SIZING.TITLE_HEIGHT;
        return (
          <Line
            points={[
              origin.x + this.state.width / 2.0,
              origin.y - contentHeight / 2.0,
              origin.x - this.state.width / 2.0 + 1.5 * VisualConstants.SIZING.ROUNDED_PADDING,
              origin.y + contentHeight / 2.0 - VisualConstants.SIZING.ROUNDED_PADDING
            ]}
            stroke={VisualConstants.POINTER.COLOR}
            strokeWidth={this.state.highlight ? VisualConstants.POINTER.BOLD_WIDTH
              : VisualConstants.POINTER.NORMAL_WIDTH}
            fill={VisualConstants.POINTER.COLOR}
          />
        );
      }
      VisualizationTool.arrowsToDraw.push(
        <Group key={this.props.variable.toString() + this.props.variable.address}>
          <Circle
            x={origin.x}
            y={origin.y}
            radius={VisualConstants.POINTER.RADIUS}
            fill={VisualConstants.POINTER.COLOR}
          />
          <Arrow
            points={points}
            stroke={VisualConstants.POINTER.COLOR}
            strokeWidth={this.state.highlight ? VisualConstants.POINTER.BOLD_WIDTH
              : VisualConstants.POINTER.NORMAL_WIDTH}
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
      const component = <VariableCard key={v.getId()} variable={v} traceStep={this.props.traceStep} x={this.props.x + 40}
                                      y={this.props.y + 40} updateVisualization={this.props.updateVisualization}
                                      squareCorners={this.props.variable.isArray()}/>;
      return { width, height, component };
    });
    return VisualizationTool.layoutNodes({
      nodes: nodesToLayout,
      origin: { x: this.props.x + 7, y: this.props.y + VisualConstants.SIZING.ORIGIN_Y_OFFSET },
      offset: this.props.variable.cType === Variable.CTypes.STRUCT_ARRAY ? { x: 0, y: 0 } : { x: 0, y: 5 },
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
