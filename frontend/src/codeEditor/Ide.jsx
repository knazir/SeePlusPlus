import React, { Component } from "react";
import { UnControlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/clike/clike";
import CodeMirrorCard from "../util/CodeMirrorCard";

class Ide extends Component {
  constructor(props) {
    super(props);
    this.state = { code: "int main() {\n\tint x = 3;\n\tstring y = \"hello\";\n\treturn 0;\n}" };
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
                lineNumbers: true
              }}
              value={"int main() {\n\tint x = 3;\n\tstring y = \"hello\";\n\treturn 0;\n}"}
              onChange={(editor, data, code) => this.setState({ code })}
            />
            <button>Visualize Code</button>
          </div>
        </CodeMirrorCard>
      </div>
    );
  }
}

export default Ide;
