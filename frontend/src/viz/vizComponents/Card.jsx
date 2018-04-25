import React, { Component } from "react";
import { Layer, Rect, Text, Group } from 'react-konva';

class Card extends Component {
    state = {
        frameWidth: Math.max(this.props.type.length, this.props.name.length, this.props.val.length * 1.5, 5) * 12,
    };
    render() {
        return (
            <Layer>
                <Group draggable={true}>
                    <Rect
                        x={this.props.x}
                        y={this.props.y}
                        width={this.state.frameWidth}
                        height={this.props.height || 50}
                        fill={'white'}
                        stroke={this.props.color}
                        strokeWidth={2}
                        cornerRadius={15}
                    >
                    </Rect>
                    <Rect
                        x={this.props.x}
                        y={this.props.y}
                        width={this.state.frameWidth}
                        height={this.props.height || 20}
                        fill={this.props.color}
                        cornerRadius={15}
                    >
                    </Rect>
                    <Rect
                        x={this.props.x}
                        y={this.props.y + 10}
                        width={this.state.frameWidth}
                        height={this.props.height || 10}
                        fill={this.props.color}
                    >
                    </Rect>
                    <Text
                        text={this.props.type + ' ' + this.props.name}
                        x={this.props.x}
                        y={this.props.y + 3}
                        fontSize={this.props.nameFontSize || 15}
                        fontFamily={'Menlo'}
                        align={'center'}
                        width={this.state.frameWidth}
                    />
                    <Text
                        text={this.props.val}
                        x={this.props.x}
                        y={this.props.y + 23}
                        fontSize={this.props.valFontSize || 25}
                        align={'center'}
                        fontFamily={'Menlo'}
                        width={this.state.frameWidth}

                    />

                </Group>
            </Layer>
        );
    }
}

export default Card;