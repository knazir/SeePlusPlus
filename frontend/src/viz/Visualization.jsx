import React, { Component } from "react";
import Card from "./vizComponents/Card";
import { Stage} from 'react-konva';

class Visualization extends Component {
    render() {
        return (
            /*TODO lw: figure out how to actually do placement here*/
            <Stage width={window.innerWidth/2} height={window.innerHeight/1.5}>
                    <Card
                        val={'3'}
                        type={'int'}
                        name={'x'}
                        x={30}
                        y={30}
                        color={'LightSkyBlue '}
                    />


                    <Card
                        val={'"hello"'}
                        type={'string'}
                        name={'y'}
                        x={30}
                        y={100}
                        color={'BlanchedAlmond'}
                    />
            </Stage>
        );
    }
}

export default Visualization;