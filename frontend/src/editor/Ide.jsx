import React, { Component } from "react";
import PropTypes from "prop-types";
import { UnControlled as CodeMirror } from "react-codemirror2";
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
    this.activeLine = null;
    this.state = {
      code: starterCode,
      isVisualizing: false,
      loading: false
    };
  }

  visualizeCode() {
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
    if (this.activeLine !== null) this.clearHighlightedLine();
    this.setState({ isVisualizing: false });
  }

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
    const t = this.cm.charCoords({ line: line, ch: 0 }, "local").top;
    const middleHeight = this.cm.getScrollerElement().offsetHeight / 2.0;
    this.cm.scrollTo(null, t - middleHeight - 5);
  }

  setupCodeMirrorInstance(ref) {
    this.cm = ref.editor;
  }

  highlightActiveLine() {
    if (this.props.trace.encounteredException()) {
      this.setState({ isVisualizing: false });
      return;
    }
    if (this.activeLine !== null) this.clearHighlightedLine();
    let lineNumber = this.props.trace.getCurrentStep().line - 1;

    // For some reason, main is highlighted as the first line of code,
    // and the first real line is skipped. Manually fixing that bug (and temporarily unfixed)
    // if (this.props.trace.atStart()) lineNumber++;
    this.highlightLine(lineNumber);
    this.scrollToLine(lineNumber);
  }

  getCodeEditor() {
    const options = {
      mode: "text/x-c++src",
      indentUnit: 4,
      lineNumbers: true,
      styleActiveLine: true,
      readOnly: this.state.isVisualizing ? "nocursor" : false
      // dragDrop: true,
      // allowDropFileTypes: ["c", "cpp", "cc", "h"]
    };

    return (
      <DomCard title="Code" color="lightgray" bodyStyle={{ padding: "0px" }}>
        <CodeMirror
          ref={this.setupCodeMirrorInstance}
          options={options}
          value={starterCode}
          onChange={(editor, data, code) => this.setState({ code })}
        />
      </DomCard>
    );
  }

  getControlButtons() {
    let buttons;
    if (this.state.loading) {
      buttons = <LoadingSpinner/>;
    } else if (!this.state.isVisualizing) {
      buttons = <button onClick={() => this.visualizeCode()}>Visualize Code</button>;
    } else {
      buttons = (
        <div className="control-buttons">
          <div className="step-button-bar">
            <button className="smaller-button" disabled={this.props.trace.atStart()}
                    onClick={() => this.props.stepStart()}>|&lt;</button>
            <button className="bigger-button" disabled={this.props.trace.atStart()} onClick={() => this.props.stepPrev()}>&lt; </button>
            <button className="bigger-button" disabled={this.props.trace.isDone()} onClick={() => this.props.stepNext()}> &gt; </button>
            <button disabled={this.props.trace.isDone()} className="smaller-button"
                    onClick={() => this.props.stepEnd()}>&gt;|</button>
          </div>
          <div>
            <button className="stop-button" onClick={() => this.stopVisualizing()}>Stop Visualization</button>
          </div>
        </div>
      );
    }
    return <div style={{ display: "flex", justifyContent: "center" }}>{buttons}</div>;
  }

  render() {
    if (this.state.isVisualizing && this.cm) this.highlightActiveLine();
    return (
      <div className="ide">
        {this.getCodeEditor()}
        {this.getControlButtons()}
      </div>
    );
  }
}
