//------------------------------------------------------------------------------
import React from "react";

import Header from "./components/Header";
import Editor from "./components/Editor";
import Visualization from "./components/Visualization";

import "./App.css";

//------------------------------------------------------------------------------
const App: React.FC = () => {
    return (
        <div className="app">
            <Header/>
            <section className="mainContent">
                <Editor width="50%"/>
                <Visualization width="50%"/>
            </section>
        </div>
    );
}

//------------------------------------------------------------------------------
export default App;
