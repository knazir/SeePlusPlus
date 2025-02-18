//------------------------------------------------------------------------------
import React from "react";

import "./Output.css";

//------------------------------------------------------------------------------
interface OutputProps {
    width?: string;
    height?: string;
}

//------------------------------------------------------------------------------
const Output: React.FC<OutputProps> = ({ width, height }) => {
    return (
        <div className="output" style={{ width, height }}>
            <div>Output</div>
        </div>
    );
}

//------------------------------------------------------------------------------
export default Output;