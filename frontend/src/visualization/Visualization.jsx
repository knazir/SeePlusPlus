import React, { Component } from "react";
import PropTypes from "prop-types";
import { Stage } from "react-konva";

import Card from "./Card";

export default class Visualization extends Component {
  static get propTypes() {
    return {
      width: PropTypes.number,
      height: PropTypes.number,
      trace: PropTypes.object
    };
  }

  getVariableNodes() {
    return this.props.trace.getCurrentStep().getVariables().map(v => {
      return <Card key={v.name} type={v.type} name={v.name} val={v.value.toString()} x={30} y={30}/>;
    });
  }

  render() {
    if (!this.props.trace) return <div style={{ width: this.props.width, height: this.props.height }}/>;
    return (
      <Stage ref={e => this.node = e} width={this.props.width} height={this.props.height}>
        {this.getVariableNodes()}
      </Stage>
    );
  }
}
