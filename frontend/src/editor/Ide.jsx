import React, { Component } from "react";
import PropTypes from "prop-types";
import { Controlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/clike/clike";

import Api from "../utils/Api";
import DomCard from "../components/DomCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { code as starterCode } from "../samples/StarterCode";
import VisualizationTool from "../utils/VisualizationTool";

export default class Ide extends Component {
  static get propTypes() {
    return {
      height: PropTypes.number.isRequired,
      onLoadTrace: PropTypes.func.isRequired,
      stepNext: PropTypes.func.isRequired,
      stepPrev: PropTypes.func.isRequired,
      stepStart: PropTypes.func.isRequired,
      stepEnd: PropTypes.func.isRequired,
      trace: PropTypes.object
    };
  }

  constructor(props) {
    super(props);
    this.setupCodeMirrorInstance = this.setupCodeMirrorInstance.bind(this);
    this.onFileDrop = this.onFileDrop.bind(this);
    this.activeLine = null;
    this.state = {
      code: starterCode,
      isVisualizing: false,
      loading: false
    };
  }

  //////////// Event Handling ////////////

  readFileAsText(file) {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
      fileReader.onerror = () => {
        fileReader.abort();
        reject(new Error("Problem parsing input file."));
      };
      fileReader.onload = () => resolve(fileReader.result);
      fileReader.readAsText(file);
    });
  }

  async onFileDrop(data, event) {
    const files = event.dataTransfer.files;
    if (!window.File || !window.FileReader || files.length === 0) {
      return;
    } else if (files.length === 1) {
      this.setState({ code: await this.readFileAsText(files[0]) });
    } else {
      let code = "";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileContents = (await this.readFileAsText(file)).trim();
        if (!fileContents) continue;
        if (i !== 0) code += "\n\n";
        code += `/********* ${file.name} *********/\n\n`;
        code += fileContents;
      }
      this.setState({ code });
    }
    return false; // equivalent to preventDefault and stopPropagation
  }

  //////////// CodeMirror Instance ////////////

  clearHighlightedLine() {
    this.cm.removeLineClass(this.activeLine);
    this.activeLine = null;
    this.cm.refresh();
  }

  highlightLine(line) {
    this.activeLine = line;
    this.cm.addLineClass(this.activeLine, "wrap", "active-code");
    this.cm.refresh();
  }

  scrollToLine(line) {
    const lineLocation = this.cm.charCoords({ line: line, ch: 0 }, "local").top;
    const middleHeight = this.cm.getScrollerElement().offsetHeight / 2.0;
    this.cm.scrollTo(null, lineLocation - middleHeight - 5);
  }

  setupCodeMirrorInstance(ref) {
    this.cm = ref.editor;
  }

  highlightActiveLine() {
    if (this.props.trace.encounteredException()) return;
    if (this.activeLine !== null) this.clearHighlightedLine();
    let lineNumber = this.props.trace.getCurrentStep().line - 1;
    this.highlightLine(lineNumber);
    this.scrollToLine(lineNumber);
  }

  //////////// State Management ////////////

  visualizeCode() {
    if (this.isVisualizing()) return;
    VisualizationTool.clearPointerArrows();
    VisualizationTool.clearRegisteredComponents();
    this.setState({ loading: true }, async () => {
      const trace = await Api.getCodeTrace("c++", this.state.code);
      this.props.onLoadTrace(trace);
      this.setState({ isVisualizing: !trace.encounteredException(), loading: false });
    });
  }

  isVisualizing() {
    return this.state.isVisualizing;
  }

  stopVisualizing() {
    if (!this.isVisualizing()) return;
    if (this.activeLine !== null) this.clearHighlightedLine();
    this.setState({ isVisualizing: false });
    VisualizationTool.clearPointerArrows();
  }

  //////////// DOM Elements ////////////

  getCodeEditor() {
    const options = {
      mode: "text/x-c++src",
      indentUnit: 4,
      lineNumbers: true,
      styleActiveLine: true,
      readOnly: this.state.isVisualizing ? "nocursor" : false,
      dragDrop: true,
      allowDropFileTypes: ["c", "cpp", "cc", "h"]
    };

    return (
      <DomCard title="Code" bodyStyle={{ padding: "0px" }}>
        <CodeMirror
          ref={this.setupCodeMirrorInstance}
          options={options}
          value={this.state.code}
          onBeforeChange={(editor, data, code) => this.setState({ code })}
          onDrop={this.onFileDrop}
          autoCursor autoScroll
        />
      </DomCard>
    );
  }

  getControlButtons() {
    const atStart = this.props.trace.atStart();
    const encounteredException = this.props.trace.encounteredException();
    const atEnd = this.props.trace.atEnd() || encounteredException;
    return (
      <div className="control-buttons">
        <div className="step-button-bar">
          <button className="smaller-button" disabled={atStart} onClick={this.props.stepStart}>|&lt;</button>
          <button className="bigger-button" disabled={atStart} onClick={this.props.stepPrev}>&lt;</button>
          <button className="bigger-button" disabled={atEnd} onClick={this.props.stepNext}>&gt;</button>
          <button className="smaller-button" disabled={atEnd} onClick={this.props.stepEnd}>&gt;|</button>
        </div>
        <div>
          <button className="stop-button" onClick={() => this.stopVisualizing()}>&nbsp;&nbsp;Stop Visualization&nbsp;&nbsp;</button>
        </div>
      </div>
    );
  }

  getButtonPanel() {
    let buttons;
    if (this.state.loading) buttons = <LoadingSpinner/>;
    else if (!this.isVisualizing()) buttons = <button onClick={() => this.visualizeCode()}>&nbsp;&nbsp;Visualize Code&nbsp;&nbsp;</button>;
    else buttons = this.getControlButtons();
    return <div className="button-panel">{buttons}</div>;
  }

  render() {
    if (this.state.isVisualizing && this.cm) this.highlightActiveLine();
    return (
      <div className="ide">
        {this.getCodeEditor()}
        {this.getButtonPanel()}
      </div>
    );
  }
}
