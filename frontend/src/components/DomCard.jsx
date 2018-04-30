import React, { Component } from "react";
import PropTypes from "prop-types";

export default class DomCard extends Component {
  static get propTypes() {
    return { title: PropTypes.string.isRequired, color: PropTypes.string.isRequired };
  }

  render() {
    return (
      <div className="CodeMirrorCard">
        <div className="box-title" style={{ "backgroundColor": this.props.color }}>
          <h3 style={{ padding: 0 }}>{this.props.title}</h3>
        </div>
        <div className="box-content" style={{ "borderColor": this.props.color, "padding": this.props.padding }}>
          {this.props.children}
        </div>
      </div>
    );
  }
}
