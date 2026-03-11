// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: frontend/src/components/CodeEditor.js
// LAYER: ui/frontend
// HEADY_BRAND:END

import React, { useRef, useEffect, useCallback } from 'react';

const LANG_KEYWORDS = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined', 'typeof', 'switch', 'case', 'break', 'default', 'require', 'module'],
  python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'raise', 'with', 'yield', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue', 'self'],
  html: ['html', 'head', 'body', 'div', 'span', 'script', 'style', 'link', 'meta', 'title', 'section', 'article', 'nav', 'header', 'footer', 'main', 'form', 'input', 'button'],
  css: ['color', 'background', 'display', 'flex', 'grid', 'margin', 'padding', 'border', 'font', 'position', 'width', 'height', 'top', 'left', 'right', 'bottom', 'overflow', 'transition', 'animation', 'opacity', 'transform'],
  json: [],
  markdown: [],
  plaintext: [],
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#12121a',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    padding: '5px 13px',
    background: '#0a0a0f',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    gap: '13px',
    fontSize: '12px',
    color: '#9898a8',
  },
  filename: {
    flex: 1,
    fontSize: '12px',
    color: '#e8e8f0',
    fontWeight: 500,
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #00d4aa, #00b894)',
    border: 'none',
    borderRadius: '5px',
    padding: '4px 13px',
    color: '#0a0a0f',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.3px',
  },
  editorWrapper: {
    flex: 1,
    display: 'flex',
    overflow: 'auto',
  },
  lineNumbers: {
    padding: '13px 8px 13px 13px',
    textAlign: 'right',
    color: '#444',
    fontSize: '13px',
    lineHeight: '21px',
    userSelect: 'none',
    minWidth: '34px',
    borderRight: '1px solid rgba(255,255,255,0.04)',
    background: '#0f0f17',
  },
  textarea: {
    flex: 1,
    padding: '13px',
    background: 'transparent',
    color: '#e8e8f0',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: '13px',
    lineHeight: '21px',
    fontFamily: 'inherit',
    tabSize: 2,
    whiteSpace: 'pre',
    overflowWrap: 'normal',
    overflowX: 'auto',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '3px 13px',
    background: '#00d4aa',
    color: '#0a0a0f',
    fontSize: '11px',
    fontWeight: 500,
    gap: '13px',
  },
};

function CodeEditor({ code = '', language = 'plaintext', onChange, onSave, filename = '' }) {
  const textareaRef = useRef(null);

  const lines = (code || '').split('\n');
  const lineCount = lines.length;

  const handleKeyDown = useCallback((e) => {
    // Ctrl+S / Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (onSave) onSave();
      return;
    }

    // Tab key inserts 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = code.substring(0, start) + '  ' + code.substring(end);
      if (onChange) onChange(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  }, [code, onChange, onSave]);

  // Determine cursor position for status bar
  const getCursorInfo = () => {
    if (!textareaRef.current) return { line: 1, col: 1 };
    const pos = textareaRef.current.selectionStart || 0;
    const textBefore = code.substring(0, pos);
    const line = (textBefore.match(/\n/g) || []).length + 1;
    const lastNewline = textBefore.lastIndexOf('\n');
    const col = pos - lastNewline;
    return { line, col };
  };

  const ext = filename ? filename.split('.').pop() : '';

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.filename}>
          {filename || 'untitled'}
        </div>
        <span>{language}</span>
        {onSave && (
          <button style={styles.saveBtn} onClick={onSave}>
            SAVE
          </button>
        )}
      </div>

      {/* Editor */}
      <div style={styles.editorWrapper}>
        <div style={styles.lineNumbers}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={code}
          onChange={(e) => onChange && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {/* Status Bar */}
      <div style={styles.statusBar}>
        <span>HEADY EDITOR</span>
        <span style={{ flex: 1 }} />
        <span>{language.toUpperCase()}</span>
        <span>Lines: {lineCount}</span>
        <span>Chars: {(code || '').length}</span>
      </div>
    </div>
  );
}

export default CodeEditor;
