import React, { Component } from "react";
import PropTypes from "prop-types";

export default class DomCard extends Component {
  static get propTypes() {
    return {
      title: PropTypes.string.isRequired,
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
    return (
      <div className="box-title" style={this.props.titleStyle}>
        <h3 style={{ padding: 0 }}>{this.props.title}</h3>
      </div>
    );
  }

  render() {
    return (
      <div style={this.props.style}>
        {this.getTitle()}
        <div className="box-content" style={this.props.bodyStyle}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
