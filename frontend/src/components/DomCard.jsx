import React, { Component } from "react";
import PropTypes from "prop-types";
import { DomCard as VisualConstants } from "../utils/VisualConstants";

export default class DomCard extends Component {
  static get propTypes() {
    return {
      title: PropTypes.string.isRequired,
      splitTitle: PropTypes.bool,
      secondTitle: PropTypes.string,
      titleStyle: PropTypes.object,
      style: PropTypes.object,
      bodyStyle: PropTypes.object,
      height: PropTypes.number
    };
  }

  static get defaultProps() {
    return { titleStyle: {}, bodyStyle: {} };
  }

  getTitle() {
    const titleStyle = Object.assign({}, this.props.titleStyle, { backgroundColor: this.props.color });
    if (this.props.splitTitle) {
      return (
        <div className="box-title split" style={titleStyle}>
          <h3>{this.props.title}</h3>
          <h3>{this.props.secondTitle}</h3>
        </div>
      );
    } else {
      return (
        <div className="box-title" style={titleStyle}>
          <h3 style={{ padding: 0 }}>{this.props.title}</h3>
        </div>
      );
    }
  }

  getSplitLine() {
    const height = this.props.height + VisualConstants.TITLE_HEIGHT;
    if (this.props.splitTitle) return <div className="split-line" style={{ height }}/>;
    return <div/>;
  }

  render() {
    const bodyStyle = Object.assign({}, this.props.bodyStyle, { borderColor: this.props.color });
    return (
      <div style={this.props.style}>
        {this.getSplitLine()}
        {this.getTitle()}
        <div className="box-content" style={bodyStyle}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
