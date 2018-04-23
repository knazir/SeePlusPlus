import React, { Component } from "react";
import Ide from "./codeEditor/Ide";
import Output from "./output/Output";
import Visualization from "./visualization/Visualization";

class App extends Component {
  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src="/img/logo.svg" className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to SeePlusPlus</h1>
        </header>
        <div className="split-view">
          <div className="split-panel code-panel">
            <Ide/>
          </div>
          <div className="split-panel vis-panel">
            <Visualization/>
            <Output/>
          </div>
        </div>
      </div>
    );
  }
}

export default App;
