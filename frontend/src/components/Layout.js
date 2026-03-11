// HEADY_BRAND:BEGIN
// HEADY SYSTEMS :: SACRED GEOMETRY
// FILE: frontend/src/components/Layout.js
// LAYER: ui/frontend
// HEADY_BRAND:END

import React, { useState } from 'react';

const PHI = 1.618033988749895;

const SIDEBAR_WIDTH = Math.round(233 * (1 / PHI)); // ~144px (Fibonacci)
const CASCADE_WIDTH = 233; // Fibonacci

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: '#0a0a0f',
    color: '#e8e8f0',
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
    overflow: 'hidden',
  },
  sidebar: {
    width: `${SIDEBAR_WIDTH}px`,
    minWidth: `${SIDEBAR_WIDTH}px`,
    background: '#0f0f1a',
    borderRight: '1px solid rgba(255,255,255,0.08)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: '13px 13px 8px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#00d4aa',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  editorArea: {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
  },
  bottomPanel: {
    height: '180px',
    minHeight: '100px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cascadePanel: {
    width: `${CASCADE_WIDTH}px`,
    minWidth: `${CASCADE_WIDTH}px`,
    background: '#0f0f1a',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    overflowY: 'auto',
  },
  resizeHandle: {
    width: '3px',
    cursor: 'col-resize',
    background: 'transparent',
    transition: 'background 0.2s',
  },
};

function Layout({ sidebar, editor, cascade, bottom }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span style={{ fontSize: '14px' }}>&#x2660;</span>
            <span>HEADY FILES</span>
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '0 4px',
              }}
              title="Collapse sidebar"
            >
              &laquo;
            </button>
          </div>
          {sidebar}
        </div>
      )}

      {sidebarCollapsed && (
        <div
          style={{
            width: '28px',
            background: '#0f0f1a',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '8px',
          }}
        >
          <button
            onClick={() => setSidebarCollapsed(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '14px',
              writingMode: 'vertical-lr',
            }}
            title="Expand sidebar"
          >
            &raquo; FILES
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={styles.main}>
        <div style={styles.editorArea}>{editor}</div>
        {bottom && <div style={styles.bottomPanel}>{bottom}</div>}
      </div>

      {/* Cascade AI panel */}
      {cascade && <div style={styles.cascadePanel}>{cascade}</div>}
    </div>
  );
}

export default Layout;
