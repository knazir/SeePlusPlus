//------------------------------------------------------------------------------
import React from "react";

import "./Editor.css";

//------------------------------------------------------------------------------
interface EditorProps {
    width?: string;
}

//------------------------------------------------------------------------------
const Editor: React.FC<EditorProps> = ({ width }) => {
    return (
        <div className="editor" style={{ width }}>
            <textarea className="editorTextArea" placeholder="Write your code here..."/>
        </div>
    );
}

//------------------------------------------------------------------------------
export default Editor;