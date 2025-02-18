//------------------------------------------------------------------------------
import React from "react";

import "./Visualization.css";

//------------------------------------------------------------------------------
interface VisualizationProps {
    width?: string;
}

//------------------------------------------------------------------------------
const Visualization: React.FC<VisualizationProps> = ({ width }) => {
    return (
        <div className="visualization" style={{ width }}>
            <div className="visualizationText">Visualization</div>
        </div>
    );
}

//------------------------------------------------------------------------------
export default Visualization;