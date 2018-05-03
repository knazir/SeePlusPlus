import React, { Component } from "react";
import PropTypes from "prop-types";

export default class DomCard extends Component {
  static get propTypes() {
    return {
      title: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      titleStyle: PropTypes.object,
      bodyStyle: PropTypes.object
    };
  }

  static get defaultProps() {
    return { titleStyle: {}, bodyStyle: {} };
  }

  render() {
    const titleStyle = Object.assign({}, this.props.titleStyle, { backgroundColor: this.props.color });
    const bodyStyle = Object.assign({}, this.props.bodyStyle, { borderColor: this.props.color });
    return (
      <div className="CodeMirrorCard">
        <div className="box-title" style={titleStyle}>
          <h3 style={{ padding: 0 }}>{this.props.title}</h3>
        </div>
        <div className="box-content" style={bodyStyle}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
