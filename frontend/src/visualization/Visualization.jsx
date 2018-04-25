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

  getCurrentStep() {

  }

  render() {
    // TODO lw: figure out how to actually do placement here
    return (
      <Stage ref={e => this.node = e} width={this.props.width} height={this.props.height}>
        <Card type="int" name="x" val="3" x={30} y={30}/>
        <Card type="string" name="y" val={"\"hello\""} x={30} y={100}/>
      </Stage>
    );
  }
}
