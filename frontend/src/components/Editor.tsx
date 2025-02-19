//------------------------------------------------------------------------------
import React, { useState } from "react";
import { Editor as MonacoEditor } from "@monaco-editor/react";

import cppLogo from "../assets/cpp.png";

import "./Editor.css";

//------------------------------------------------------------------------------
const defaultCode: string = `
#include <iostream>

int main()
{
    std::cout << "Hello, world!" << std::endl;
    return 0;
}`.trim();

//------------------------------------------------------------------------------
interface EditorProps {
    width?: string;
    height?: string;
}

//------------------------------------------------------------------------------
const Editor: React.FC<EditorProps> = ({ width, height }) => {
    const [code, setCode] = useState<string>(defaultCode);

    return (
        <div className="editor" style={{ width, height }}>
            <div className="tabBar">
                <div className="fileTab">
                    <img src={cppLogo} alt="C++ Logo"/>
                    <code>main.cpp</code>
                </div>
            </div>
            <MonacoEditor width="100%"
                          height="100%"
                          defaultLanguage="cpp"
                          defaultValue={code}
                          onChange={(value) => setCode(value || "")}
                          theme="vs-dark"
            />
        </div>
    );
}

//------------------------------------------------------------------------------
export default Editor;