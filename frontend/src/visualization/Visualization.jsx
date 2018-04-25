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

  getVariableCards() {
    const currentStep = this.props.trace.getCurrentStep();
    return currentStep.getVariables().map((v, index) => {
      return <Card key={`${v.name}-${index}`} type={v.type} name={v.name} val={v.value.toString()} x={30} y={30}/>
    });
  }

  render() {
    if (!this.props.trace) return <div style={{ width: this.props.width, height: this.props.height }}/>;

    const variables = this.getVariableCards();

    // TODO lw: figure out how to actually do placement here
    return (
      <Stage ref={e => this.node = e} width={this.props.width} height={this.props.height}>
        {/*<Card type="int" name="x" val="3" x={30} y={30}/>*/}
        {/*<Card type="string" name="y" val={"\"hello\""} x={30} y={100}/>*/}
        {variables}
      </Stage>
    );
  }
}
