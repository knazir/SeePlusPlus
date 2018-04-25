import React, { Component } from "react";
import PropTypes from "prop-types";
import { UnControlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/clike/clike";

import Api from "../utils/Api";
import DomCard from "../components/DomCard";

export default class Ide extends Component {
  static get propTypes() {
    return { onLoadTrace: PropTypes.func.isRequired };
  }

  constructor(props) {
    super(props);
    this.state = {
      code: "int main() {\n\tint x = 3;\n\tchar *y = \"hello\";\n\treturn 0;\n}",
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
    this.setState({ isVisualizing: false });
  }

  getCodeEditor() {
    const options = {
      mode: "text/x-c++src",
      indentUnit: 4,
      lineNumbers: true,
      readOnly: this.state.isVisualizing ? "nocursor" : false
    };

    return (
      <DomCard title="Code" color="#71CCA8">
        <CodeMirror
          options={options}
          value={"int main() {\n\tint x = 3;\n\tchar *y = \"hello\";\n\treturn 0;\n}"}
          onChange={(editor, data, code) => this.setState({ code })}
        />
      </DomCard>
    );
  }

  getControlButtons() {
    let buttons;
    if (this.state.loading) {
      buttons = <div className="loader"/>;
    } else if (!this.state.isVisualizing) {
      buttons = <button onClick={() => this.visualizeCode()}>Visualize Code</button>;
    } else {
      buttons = (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex" }}>
            <button>|&lt;</button>
            <button>&lt;</button>
            <button>&gt;</button>
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
    return (
      <div className="ide">
        {this.getCodeEditor()}
        {this.getControlButtons()}
      </div>
    );
  }
}
