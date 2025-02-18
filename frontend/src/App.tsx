//------------------------------------------------------------------------------
import React from "react";

import Header from "./components/Header";
import Editor from "./components/Editor";
import Output from "./components/Output";
import Visualization from "./components/Visualization";

import "./App.css";

//------------------------------------------------------------------------------
const App: React.FC = () => {
    return (
        <div className="app">
            <Header height="6vh"/>
            <section className="mainContent" style={{ height: "74vh" }}>
                <Editor width="50%"/>
                <Visualization width="50%"/>
            </section>
            <section className="output" style={{ height: "20vh" }}>
                <Output/>
            </section>
        </div>
    );
}

//------------------------------------------------------------------------------
export default App;
