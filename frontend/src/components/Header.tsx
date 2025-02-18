import React from "react";

import githubIcon from "../assets/github.png";
import logo from "../assets/logo.png";
import supportIcon from "../assets/support.png";

import "./Header.css";

export default function Header() {
    return (
        <header className="header">
            <img className="logo" src={logo}/>
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