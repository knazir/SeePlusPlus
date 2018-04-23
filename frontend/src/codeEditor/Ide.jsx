import React, { Component } from "react";
import { UnControlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/clike/clike";
import CodeMirrorCard from "../util/CodeMirrorCard";

class Ide extends Component {
  constructor(props) {
    super(props);
    this.state = { code: "int main() {\n\tint x = 3;\n\tstring y = \"hello\";\n\treturn 0;\n}",
                   isVisualizing: false };
  }

  render() {
    return (
      <div className="ide">
        <CodeMirrorCard title="My Code Editor" color="#71CCA8">
          <div>
            <CodeMirror
              options={{
                mode: "text/x-c++src",
                indentUnit: 4,
                lineNumbers: true,
                readOnly: this.state.isVisualizing ? "nocursor" : false
              }}
              value={"int main() {\n\tint x = 3;\n\tstring y = \"hello\";\n\treturn 0;\n}"}
              onChange={(editor, data, code) => this.setState({ code })}
            />
          </div>
        </CodeMirrorCard>
        <div style={{ display: "flex", justifyContent: "center" }}>
          { this.getButtons() }
        </div>
      </div>
    );
  }

  getButtons() {
    if (this.state.isVisualizing) {
      return (
        <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
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
    } else {
      return (
          <button onClick={() => this.visualizeCode()}>Visualize Code</button>
      );
    }
  }

  visualizeCode() {
    this.setState({ isVisualizing: true });
  }

  stopVisualizing() {
    this.setState({ isVisualizing: false });
  }
}

export default Ide;
