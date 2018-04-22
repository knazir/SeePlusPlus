import React, { Component } from "react";
import { Layer, Rect, Text, Group } from 'react-konva';

class Card extends Component {
    state = {
        frameWidth: Math.max(this.props.type.length, this.props.name.length, this.props.val.length * 1.5, 5) * 10,
        color: 'white'
    };
    render() {
        return (
            <Layer>
                <Group>
                    <Rect
                        x={this.props.x}
                        y={this.props.y}
                        width={this.state.frameWidth}
                        height={50}
                        fill={this.state.color}
                        shadowBlur={5}
                        onClick={this.handleClick}
                        cornerRadius={15}
                    >
                    </Rect>
                    <Text
                        text={this.props.type + ' ' + this.props.name}
                        x={this.props.x}
                        y={this.props.y + 3}
                        fontSize={15}
                        align={'center'}
                        width={this.state.frameWidth}
                    />
                    <Text
                        text={this.props.val}
                        x={this.props.x}
                        y={this.props.y + 20}
                        fontSize={30}
                        align={'center'}
                        width={this.state.frameWidth}

                    />

                </Group>
            </Layer>
        );
    }
}

export default Card;