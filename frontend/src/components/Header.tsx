//------------------------------------------------------------------------------
import React from "react";

import githubIcon from "../assets/github.png";
import logo from "../assets/logo.png";
import supportIcon from "../assets/support.png";

import "./Header.css";

//------------------------------------------------------------------------------
interface HeaderProps {
    height?: string;
}

//------------------------------------------------------------------------------
const Header: React.FC<HeaderProps> = ({ height }) => {
    return (
        <header className="header" style={{ height }}>
            <img className="logo" src={logo} alt="See++ Logo"/>
            <div className="headerButtons">
                <button className="headerButton">
                    <img src={supportIcon} alt="Support Icon"/>
                    <span>Support the Project</span>
                </button>
                <button className="headerButton">
                    <img src={githubIcon} alt="GitHub Icon"/>
                    <span>View on GitHub</span>
                </button>
            </div>
        </header>
    );
}

//------------------------------------------------------------------------------
export default Header;