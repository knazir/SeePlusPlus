import React, { Component } from "react";
import ContainerDimensions from "react-container-dimensions";

import Ide from "./editor/Ide";
import Output from "./visualization/Output";
import Visualization from "./visualization/Visualization";

export default class App extends Component {
  constructor(props) {
    super(props);
    this.resize = this.resize.bind(this);
    this.state = { trace: null };
  }



  resize() {
    this.forceUpdate();
  }

  loadTrace(trace) {
    window.trace = trace;
    this.setState({ trace });
  }

  stepNext() {
    this.state.trace.stepNext();
    this.forceUpdate();
  }

  stepPrev() {
    this.state.trace.stepPrev();
    this.forceUpdate();
  }

  stepStart() {
    this.state.trace.stepStart();
    this.forceUpdate();
  }

  stepEnd() {
    this.state.trace.stepEnd();
    this.forceUpdate();
  }

  render() {
    return (
      <div className="App">
        <div className="split-view">
          <div className="split-panel code-panel">
            <Ide onLoadTrace={trace => this.loadTrace(trace)} trace={this.state.trace}
                 stepNext={() => this.stepNext()} stepPrev={() => this.stepPrev()}
                 stepStart={() => this.stepStart()} stepEnd={() => this.stepEnd()}/>
          </div>
          <div className ="split-bar" />
          <div className="split-panel vis-panel">
            <ContainerDimensions>
              {({ width, height }) => <Visualization width={width} height={height * 0.8} trace={this.state.trace}/>}
            </ContainerDimensions>
            <ContainerDimensions>
              {({ width, height }) => <Output width={width} height={height * 0.2}/>}
            </ContainerDimensions>
          </div>
        </div>
        <p style={{ fontSize: "small", textAlign: "center" }}>&copy; 2018 by SeePlusPlus</p>
      </div>
    );
  }
}
