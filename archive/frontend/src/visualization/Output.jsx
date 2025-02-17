import React, { Component } from "react";
import PropTypes from "prop-types";
import DomCard from "../components/DomCard";

class Output extends Component {
  static get propTypes() {
    return { width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), height: PropTypes.number };
  }

  render() {
    return (
      <div className="output" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard title="Output" bodyStyle={{ padding: "10px" }}>
          <div className="output-text">
            {this.props.children}
          </div>
        </DomCard>
      </div>
    );
  }
}

export default Output;
