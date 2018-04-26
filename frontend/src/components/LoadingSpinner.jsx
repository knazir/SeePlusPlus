import React, { Component } from "react";
import PropTypes from "prop-types";

export default class LoadingSpinner extends Component {
  static get propTypes() {
    return { style: PropTypes.object };
  }

  render() {
    return <div className="loader" style={this.props.style}/>;
  }
}
