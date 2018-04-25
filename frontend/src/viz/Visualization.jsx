import React, { Component } from "react";
import { Stage } from "react-konva";

import Card from "./vizComponents/Card";

class Visualization extends Component {
  render() {
    // TODO lw: figure out how to actually do placement here
    return (
      <Stage width={window.innerWidth / 2} height={window.innerHeight / 1.5}>
        <Card type="int" name="x" val="3" x={30} y={30}/>
        <Card type="string" name="y" val={"\"hello\""} x={30} y={100}/>
      </Stage>
    );
  }
}

export default Visualization;
