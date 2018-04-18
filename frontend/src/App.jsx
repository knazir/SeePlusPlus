import React, { Component } from "react";

import Api from "./Api";

class App extends Component {
  async componentDidMount() {
    const res = await Api.getCodeTrace("c", "int main() { int x = 5; return 0; }");
    console.log(res);
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={"/img/logo.svg"} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to SeePlusPlus</h1>
        </header>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>
      </div>
    );
  }
}

export default App;
