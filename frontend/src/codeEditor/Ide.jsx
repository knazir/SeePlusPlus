import React, { Component } from "react";
import { UnControlled as CodeMirror } from "react-codemirror2";
import "codemirror/mode/clike/clike";

class Ide extends Component {
  constructor(props) {
    super(props);
    this.state = { code: "int main() {\n\tint x = 3;\n\tstring y = \"hello\";\n\treturn 0;\n}" };
  }

  render() {
    return (
      <div className="ide">
        <CodeMirror
          options={{
            mode: "text/x-c++src",
            indentUnit: 4,
            lineNumbers: true
          }}
          value={ "int main() {\n\tint x = 3;\n\tstring y = \"hello\";\n\treturn 0;\n}" }
          onChange={(editor, data, value) => {
            this.setState({ code: value });
          }}
        >
          int main() int x = 3; string y = "hello"; return 0;
        </CodeMirror>
        <button>Visualize Code</button>
      </div>
    );
  }
}

export default Ide;
