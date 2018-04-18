import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import registerServiceWorker from "./registerServiceWorker";

require("dotenv").config();

ReactDOM.render(<App/>, document.getElementById("root"));
registerServiceWorker();
