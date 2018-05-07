import React, { Component } from "react";
import PropTypes from "prop-types";
import DomCard from "../components/DomCard";

class Output extends Component {
  static get propTypes() {
    return { width: PropTypes.number, height: PropTypes.number };
  }

  render() {
    return (
      <div className="output" style={{ width: this.props.width, height: this.props.height }}>
        <DomCard title="Output" color="lightgray" bodyStyle={{ padding: "10px" }}>
          <div className="output-text">
            {this.props.children}
          </div>
        </DomCard>
      </div>
    );
  }
}

export default Output;
