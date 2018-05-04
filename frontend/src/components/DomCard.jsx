import React, { Component } from "react";
import PropTypes from "prop-types";
import VisualizationTool from "../utils/VisualizationTool";
import Variable from "../models/Variable";

export default class DomCard extends Component {
  static get propTypes() {
    return {
      title: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      titleStyle: PropTypes.object,
      bodyStyle: PropTypes.object,
      splitTitle: PropTypes.bool,
      title2: PropTypes.string
    };
  }

  static get defaultProps() {
    return { titleStyle: {}, bodyStyle: {} };
  }

  getTitle(titleStyle) {
      if (this.props.splitTitle) {
        return (
            <div className="box-title split" style={titleStyle}>
                <h3 style={{ padding: '0% 0% 0% 25%' }}>{this.props.title}</h3>
                <h3 style={{ padding: '0% 25% 0% 0%' }}>{this.props.title2}</h3>
            </div>
        )
      } else {
        return (
          <div className="box-title" style={titleStyle}>
            <h3 style={{ padding: 0 }}>{this.props.title}</h3>
          </div>
        );
      }
  }

  getSplitLine() {
    let height = this.props.height + 31;

    if (this.props.splitTitle) {
      return (
          <div className="split-line" style={{height: height}}/>
      )
    }
  }

  render() {
    const titleStyle = Object.assign({}, this.props.titleStyle, { backgroundColor: this.props.color });
    const bodyStyle = Object.assign({}, this.props.bodyStyle, { borderColor: this.props.color });
    return (
      <div className="CodeMirrorCard">
          {this.getSplitLine()}
          {this.getTitle(titleStyle)}
        <div className="box-content" style={bodyStyle}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
