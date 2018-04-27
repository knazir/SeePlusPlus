import React, { Component } from "react";
import PropTypes from "prop-types";
import { UnControlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/clike/clike";

import Api from "../utils/Api";
import DomCard from "../components/DomCard";
import LoadingSpinner from "../components/LoadingSpinner";

export default class Ide extends Component {
  static get propTypes() {
    return {
      onLoadTrace: PropTypes.func.isRequired,
      stepNext: PropTypes.func.isRequired,
      stepPrev: PropTypes.func.isRequired,
      trace: PropTypes.object
    };
  }

  constructor(props) {
    super(props);
    this.setupCodeMirrorInstance = this.setupCodeMirrorInstance.bind(this);
    this.activeLine = null;
    this.state = {
      code: "int a = 32;\n\nint main() {\n\tint x = 3;\n\tchar *y = \"hello\";\n\treturn 0;\n}",
      isVisualizing: false,
      loading: false
    };
  }

  visualizeCode() {
    this.setState({ loading: true }, async () => {
      const trace = await Api.getCodeTrace("c++", this.state.code);
      this.props.onLoadTrace(trace);
      this.setState({ isVisualizing: true, loading: false });
    });
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

  setupCodeMirrorInstance(ref) {
    this.cm = ref.editor;
  }

  highlightActiveLine() {
    if (this.activeLine !== null) this.clearHighlightedLine();
    this.highlightLine(this.props.trace.getCurrentStep().line - 1);
  }

  getCodeEditor() {
    const options = {
      mode: "text/x-c++src",
      indentUnit: 4,
      lineNumbers: true,
      styleActiveLine: true,
      readOnly: this.state.isVisualizing ? "nocursor" : false
    };

    return (
      <DomCard title="Code" color="lightgray">
        <CodeMirror
          ref={this.setupCodeMirrorInstance}
          options={options}
          value={"int a = 32;\n\nint main() {\n\tint x = 3;\n\tchar *y = \"hello\";\n\treturn 0;\n}"}
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex" }}>
            <button>|&lt;</button>
            <button onClick={() => this.props.stepPrev()}>&lt;</button>
            <button onClick={() => this.props.stepNext()}>&gt;</button>
            <button>&gt;|</button>
          </div>
          <div>
            <button onClick={() => this.stopVisualizing()}>Stop Visualization</button>
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
