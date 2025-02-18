//------------------------------------------------------------------------------
import React from "react";

import "./Visualization.css";

//------------------------------------------------------------------------------
interface VisualizationProps {
    width?: string;
    height?: string;
}

//------------------------------------------------------------------------------
const Visualization: React.FC<VisualizationProps> = ({ width, height }) => {
    return (
        <div className="visualization" style={{ width, height }}>
            <div>Visualization</div>
        </div>
    );
}

//------------------------------------------------------------------------------
export default Visualization;