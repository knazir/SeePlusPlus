import React, { Component } from "react";
import Ide from "./codeEditor/Ide";
import Visualization from "./viz/Visualization";
import Output from "./output/Output";

class App extends Component {
  render() {
    return (
      <div className="App">
        <div className="split-view">
          <div className="split-panel code-panel">
            <Ide/>
          </div>
          <div className="split-panel vis-panel">
            <Visualization/>
            <Output/>
          </div>
        </div>
        <p style={{ fontSize: "small", textAlign: "center" }}>&copy; 2018 by SeePlusPlus</p>
      </div>
    );
  }
}

export default App;
