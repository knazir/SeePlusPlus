import React, { Component } from "react";
import CodeMirrorCard from "../util/CodeMirrorCard";

class Output extends Component {
  constructor(props) {
    super(props);
    this.state = { value: "This will display output." };
  }

  render() {
    return (
      <div className="output">
        <CodeMirrorCard title="Output" color="coral">
          <div className="output-text">
            {this.state.value}
          </div>
        </CodeMirrorCard>
      </div>
    );
  }
}

export default Output;
