import React, { Component } from "react";
import PropTypes from "prop-types";

class CodeMirrorCard extends Component {
  render() {
    return (
      <div className="CodeMirrorCard">
        <div className="box-title" style={{ "backgroundColor": this.props.color }}>
          <h3 style={{ padding: "0px" }}>{this.props.title}</h3>
        </div>
        <div className="box-content" style={{ "borderColor": this.props.color }}>
          {this.props.children}
        </div>
      </div>
    );
  }
}

CodeMirrorCard.propTypes = {
  title: PropTypes.string.isRequired,
  color: PropTypes.string
};

CodeMirrorCard.defaultProps = {
  title: "Dummy",
  color: "teal"
};

export default CodeMirrorCard;
