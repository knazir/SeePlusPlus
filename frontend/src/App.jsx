import React, { Component } from "react";
import ContainerDimensions from "react-container-dimensions";

import Ide from "./editor/Ide";
import Output from "./visualization/Output";
import Visualization from "./visualization/Visualization";
import VisualizationTool from "./utils/VisualizationTool";

export default class App extends Component {
  constructor(props) {
    super(props);
    this.handleKeyCommands = this.handleKeyCommands.bind(this);
    this.superHackyForceUpdate = this.superHackyForceUpdate.bind(this);
    this.state = { trace: null, timer: null, delay: 1500 };
  }

  //////////// React Lifecycle ////////////

  componentDidMount() {
    window.addEventListener("keydown", this.handleKeyCommands);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.handleKeyCommands);
  }

  //////////// Event Handling ////////////

  handleKeyCommands(event) {
    // disable saving web page through shortcut
    if (event.ctrlKey || event.metaKey) {
      switch (event.which) {
        case 83: event.preventDefault(); break; // s
        case 13: event.preventDefault(); this.ide.visualizeCode(); break; // enter
        case 27: event.preventDefault(); this.ide.stopVisualizing(); break; // escape
        case 37: event.preventDefault(); this.stepStart(); break; // left arrow
        case 39: event.preventDefault(); this.stepEnd(); break; // right arrow
        default: return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && event.which === 83 /* s */) {
      event.preventDefault();
      return;
    }

    if (!this.state.trace || !this.ide.isVisualizing()) return;
    switch (event.which) {
      case 37: this.stepPrev(true); break; // left arrow
      case 39: this.stepNext(true); break; // right arrow
      default: break;
    }
  }

  //////////// State Management ////////////

  loadTrace(trace) {
    window.trace = trace;
    // set trace to null to reset visualization
    this.setState({ trace: null }, () => this.setState({ trace }));
  }

  // TODO: One day we'll figure out why this works and how to not do it...
  superHackyForceUpdate(callback) {
    VisualizationTool.clearAllArrowComponents();
    this.forceUpdate(() => this.forceUpdate(callback));
  }

  stepNext(keypress = false) {
    if (!this.state.trace.stepNext()) return;
    if (keypress) this.ide.highlightButton("stepNext");
    this.superHackyForceUpdate();
  }

  stepPrev(keypress = false) {
    if (!this.state.trace.stepPrev()) return;
    if (keypress) this.ide.highlightButton("stepPrev");
    this.superHackyForceUpdate();
  }

  stepStart(keypress = false) {
    if (!this.state.trace.stepStart()) return;
    if (keypress) this.ide.highlightButton("stepStart");
    this.superHackyForceUpdate();
  }

  stepEnd(keypress = false) {
    if (!this.state.trace.stepEnd()) return;
    if (keypress) this.ide.highlightButton("stepEnd");
    this.superHackyForceUpdate();
  }

  stepPlay() {
    this.stepNext();
    this.setState({ timer: this._setupTimer() });
  }

  stepStop() {
    if (this.state.timer) {
      clearTimeout(this.state.timer);
      this.setState({ timer: null });
    }
  }

  stepLine(lineNumber) {
    if (!this.state.trace || !this.state.trace.stepLine(lineNumber)) return;
    this.superHackyForceUpdate();
  }

  fastForward() {
    this.setState({ delay: this.state.delay * 0.9 });
  }

  fastBackward() {
    this.setState({ delay: this.state.delay * 1.1 });
  }

  _setupTimer() {
    return setTimeout(() => {
        if (!this.state.trace.stepNext()) {
          clearTimeout(this.state.timer);
          return;
        }
        this.superHackyForceUpdate(() => this.setState({ timer: this._setupTimer() }));
      }, this.state.delay);
  }

  //////////// DOM Elements ////////////

  getOutput() {
    if (!this.state.trace) return;
    const encounteredException = this.state.trace.encounteredException();
    return <div className={`${encounteredException ? "exception-message" : ""}`}>{this.state.trace.getOutput()}</div>;
  }

  getEditorPanel() {
    return (
      <div className="split-panel code-panel">
        <ContainerDimensions>
          {({ width, height }) => <Ide ref={ide => this.ide = ide} onLoadTrace={trace => this.loadTrace(trace)}
                                       trace={this.state.trace} height={height}
                                       stepNext={() => this.stepNext()} stepPrev={() => this.stepPrev()}
                                       stepStart={() => this.stepStart()} stepEnd={() => this.stepEnd()}
                                       stepPlay={() => this.stepPlay()} stepStop={() => this.stepStop()}
                                       fastForward={() => this.fastForward()} fastBackward={() => this.fastBackward()}
                                       stepLine={(lineNumber) => this.stepLine(lineNumber)}/>}
        </ContainerDimensions>
      </div>
    );
  }

  getVisualizationPanel() {
    return (
      <div className="split-panel vis-panel">
        <ContainerDimensions>
          {({ width, height }) => <Visualization width={width} height={height * 0.8} trace={this.state.trace}
                                                 updateVisualization={this.superHackyForceUpdate}/>}
        </ContainerDimensions>
        <ContainerDimensions>
          {({ width, height }) => <Output width="calc(100% + 20px)" height={height * 0.2}>{this.getOutput()}</Output>}
        </ContainerDimensions>
      </div>
    );
  }

  render() {
    return (
      <div className="App">
        <div className="split-view">
          {this.getEditorPanel()}
          <div className ="split-bar"/>
          {this.getVisualizationPanel()}
        </div>
        <p className="copyright">&copy; 2018 by See++</p>
      </div>
    );
  }
}
