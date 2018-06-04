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
      stepPlay: PropTypes.func.isRequired,
      stepStop: PropTypes.func.isRequired,
      stepLine: PropTypes.func.isRequired,
      trace: PropTypes.object
    };
  }

  constructor(props) {
    super(props);
    this.setupCodeMirrorInstance = this.setupCodeMirrorInstance.bind(this);
    this.onFileDrop = this.onFileDrop.bind(this);
    this.onGutterClick = this.onGutterClick.bind(this);
    this.stop = this.stop.bind(this);
    this.play = this.play.bind(this);
    this.activeLine = null;
    this.state = {
      code: starterCode,
      isVisualizing: false,
      loading: false,
      buttonClassNames: {
        stepStart: "smaller-button",
        stepPrev: "bigger-button",
        stepPlay: "bigger-button",
        stepStop: "bigger-button",
        stepNext: "bigger-button",
        stepEnd: "smaller-button"
      }
    };
  }
  
  //////////// React Lifecycle ////////////

  componentDidMount() {
    this.resetVisualizingDom();
  }
  
  componentWillReceiveProps(props) {
    if (!props.trace) return;
    const encounteredException = props.trace.encounteredException();
    const atEnd = props.trace.atEnd() || encounteredException;
    if (atEnd) this.setState({ isPlaying: false });
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
    if (this.isVisualizing()) return;
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

  onGutterClick(editor, lineNumber) {
    if (!this.isVisualizing()) return;
    this.props.stepLine(lineNumber + 1); // account for 0-indexed lines
  }

  //////////// Animation Handling ////////////

  play() {
    this.setState({ isPlaying: true });
    this.props.stepPlay();
  }

  stop() {
    this.setState({ isPlaying: false });
    this.props.stepStop();
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
    VisualizationTool.clearArrowComponents();
    VisualizationTool.clearRegisteredComponents();
    this.setState({ loading: true }, async () => {
      const trace = await Api.getCodeTrace("c++", this.state.code);
      this.props.onLoadTrace(trace);
      this.setState({ isVisualizing: !trace.encounteredException(), loading: false }, () => {
        if (this.isVisualizing()) this.setupVisualizingDom();
      });
    });
  }

  isVisualizing() {
    return this.state.isVisualizing;
  }

  stopVisualizing() {
    if (!this.isVisualizing()) return;
    if (this.activeLine !== null) this.clearHighlightedLine();
    this.setState({ isVisualizing: false }, () => this.resetVisualizingDom());
  }

  revertButtons() {
    this.setState({
      buttonClassNames: {
        stepStart: "smaller-button",
        stepPrev: "bigger-button",
        stepPlay: "bigger-button",
        stepStop: "bigger-button",
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

  //////////// DOM Manipulation ////////////

  setupVisualizingDom() {
    document.querySelectorAll(".CodeMirror-gutter-elt").forEach(element => element.classList.remove("unclickable"));
    const codeMirrorLines = document.querySelector(".CodeMirror-lines");
    if (codeMirrorLines) codeMirrorLines.classList.add("disabled");
  }

  resetVisualizingDom() {
    document.querySelectorAll(".CodeMirror-gutter-elt").forEach(element => element.classList.add("unclickable"));
    const codeMirrorLines = document.querySelector(".CodeMirror-lines");
    if (codeMirrorLines) codeMirrorLines.classList.remove("disabled");
  }

  //////////// DOM Elements ////////////

  getCodeEditor() {
    const options = {
      mode: "text/x-c++src",
      indentUnit: 4,
      lineNumbers: true,
      styleActiveLine: true,
      readOnly: this.isVisualizing() ? "nocursor" : false,
      dragDrop: true,
      allowDropFileTypes: ["c", "cpp", "cc", "h"],
      viewportMargin: Infinity
    };

    const cardStyle = { height: "95%", marginBottom: "8px" };
    const bodyStyle = { padding: "0px", height: "calc(100% - 28px)" };

    return (
      <DomCard title="Code" style={cardStyle} bodyStyle={bodyStyle}>
        <div className={`codeArea ${this.isVisualizing() ? "disabled" : ""}`}>
          <CodeMirror
            ref={this.setupCodeMirrorInstance}
            options={options}
            value={this.state.code}
            onBeforeChange={(editor, data, code) => this.setState({ code })}
            onDrop={this.onFileDrop}
            onGutterClick={this.onGutterClick}
            autoCursor autoScroll
          />
        </div>
      </DomCard>
    );
  }

  getVisualizeButton() {
    return (
      <button onClick={() => this.visualizeCode()} className="main-button">
        &nbsp;&nbsp;Visualize Code&nbsp;&nbsp;
      </button>
    );
  }

  getStopVisualizingButton() {
    return (
      <button className="main-button stop-button" onClick={() => this.stopVisualizing()}>
        &nbsp;&nbsp;Stop Visualization&nbsp;&nbsp;
      </button>
    );
  }

  getPlayButton(atEnd) {
    const stepPlay = this.state.buttonClassNames.stepPlay;
    return <button className={stepPlay} disabled={atEnd} onClick={this.play}>play</button>;
  }

  getStopButton(atEnd) {
    const stepStop = this.state.buttonClassNames.stepStop;
    return <button className={stepStop} disabled={atEnd} onClick={this.stop}>stop</button>;
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
          {!this.state.isPlaying ? this.getPlayButton(atEnd) : this.getStopButton(atEnd)}
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
    if (this.isVisualizing() && this.cm) this.highlightActiveLine();
    return (
      <div className="ide">
        {this.getCodeEditor()}
        {this.getButtonPanel()}
      </div>
    );
  }
}
