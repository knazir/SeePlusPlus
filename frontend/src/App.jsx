import React, { Component } from "react";
import ContainerDimensions from "react-container-dimensions";

import Ide from "./editor/Ide";
import Output from "./visualization/Output";
import Visualization from "./visualization/Visualization";

export default class App extends Component {
  constructor(props) {
    super(props);
    this.handleKeyCommands = this.handleKeyCommands.bind(this);
    this.state = { trace: null };
  }

  componentDidMount() {
    window.addEventListener("keydown", this.handleKeyCommands)
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.handleKeyCommands);
  }

  handleKeyCommands(event) {
    // disable saving web page through shortcut
    if (event.ctrlKey || event.metaKey) {
      switch(event.which) {
        case 83: event.preventDefault(); break; // s
        case 13: this.ide.visualizeCode(); break; // enter
        case 27: this.ide.stopVisualizing(); break; // escape
        case 37: this.stepStart(); break; // left arrow
        case 39: this.stepEnd(); break; // right arrow
        default: return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.which === 83 /* s */) {
      event.preventDefault();
      return;
    }

    if (!this.state.trace) return;
    switch (event.which) {
      case 37: this.stepPrev(); break;  // left arrow
      case 39: this.stepNext(); break;  // right arrow
      default: return;
    }
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
            <Ide ref={ide => this.ide = ide} onLoadTrace={trace => this.loadTrace(trace)} trace={this.state.trace}
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
