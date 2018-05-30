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
      loading: false,
      buttonClassNames: {
        stepStart: "smaller-button",
        stepPrev: "bigger-button",
        stepNext: "bigger-button",
        stepEnd: "smaller-button"
      }
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

  fileAllowed(filename) {
    if (filename.indexOf(".") === -1) return false;
    const extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
    return ["cpp", "cc", "c", "cxx", "c++", "h", "hh", "hxx", "hpp", "h++"].indexOf(extension) !== -1;
  }

  async onFileDrop(data, event) {
    if (this.state.isVisualizing) return;
    const files = event.dataTransfer.files;
    if (!window.File || !window.FileReader || files.length === 0) {
      return;
    } else if (files.length === 1) {
      if (!this.fileAllowed(files[0].name)) return;
      this.setState({ code: await this.readFileAsText(files[0]) });
    } else {
      let code = "";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!this.fileAllowed(file.name)) continue;
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
  }

  revertButtons() {
    this.setState({
      buttonClassNames: {
        stepStart: "smaller-button",
        stepPrev: "bigger-button",
        stepNext: "bigger-button",
        stepEnd: "smaller-button"
      }
    });
  }

  temporarilyUpdateButton(button) {
    const originalClassName = this.state.buttonClassNames[button];
    const buttonClassNames = this.state.buttonClassNames;
    buttonClassNames[button] = `${originalClassName} active`;
    this.setState({ buttonClassNames });
    setTimeout(() => this.revertButtons(), 100);
  }

  highlightButton(button) {
    this.temporarilyUpdateButton(button);
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
        <div className="codeArea" style={{ background: this.state.isVisualizing ? "#f4f4f4" : "white" }}>
          <CodeMirror
            ref={this.setupCodeMirrorInstance}
            options={options}
            value={this.state.code}
            onBeforeChange={(editor, data, code) => this.setState({ code })}
            onDrop={this.onFileDrop}
            autoCursor autoScroll
          />
        </div>
      </DomCard>
    );
  }

  getVisualizeButton() {
    return (
      <button onClick={() => this.visualizeCode()}>
        &nbsp;&nbsp;Visualize Code&nbsp;&nbsp;
      </button>
    );
  }

  getStopVisualizingButton() {
    return (
      <button className="stop-button" onClick={() => this.stopVisualizing()}>
        &nbsp;&nbsp;Stop Visualization&nbsp;&nbsp;
      </button>
    );
  }

  getControlButtons() {
    const atStart = this.props.trace.atStart();
    const encounteredException = this.props.trace.encounteredException();
    const atEnd = this.props.trace.atEnd() || encounteredException;
    const { stepStart, stepPrev, stepNext, stepEnd } = this.state.buttonClassNames;
    return (
      <div className="control-buttons">
        <div className="step-button-bar">
          <button className={stepStart} disabled={atStart} onClick={this.props.stepStart}>|&lt;</button>
          <button className={stepPrev} disabled={atStart} onClick={this.props.stepPrev}>&lt;</button>
          <button className={stepNext} disabled={atEnd} onClick={this.props.stepNext}>&gt;</button>
          <button className={stepEnd} disabled={atEnd} onClick={this.props.stepEnd}>&gt;|</button>
        </div>
        <div>
          {this.getStopVisualizingButton()}
        </div>
      </div>
    );
  }

  getButtonPanel() {
    let buttons;
    if (this.state.loading) buttons = <LoadingSpinner/>;
    else if (!this.isVisualizing()) buttons = this.getVisualizeButton();
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
