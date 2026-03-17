// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: HeadyAI-IDE/src/components/TabBar.jsx                     ║
// ║  LAYER: frontend/src/components                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Circle, Code, FileText, File, Image, Settings as SettingsIcon } from 'lucide-react';
import { useIDE, useIDEActions } from '../stores/ideStore';

const getFileIcon = (name) => {
  if (!name) return File;
  const ext = name.split('.').pop()?.toLowerCase();
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt'];
  const textExts = ['md', 'txt', 'log', 'csv'];
  const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
  const configExts = ['json', 'yaml', 'yml', 'toml', 'ini', 'xml'];
  if (codeExts.includes(ext)) return Code;
  if (textExts.includes(ext)) return FileText;
  if (imgExts.includes(ext)) return Image;
  if (configExts.includes(ext)) return SettingsIcon;
  return File;
};

const getExtColor = (name) => {
  if (!name) return '#94a3b8';
  const ext = name.split('.').pop()?.toLowerCase();
  const colors = {
    js: '#f7df1e', jsx: '#61dafb', ts: '#3178c6', tsx: '#61dafb',
    py: '#3776ab', java: '#ed8b00', cpp: '#00599c', c: '#a8b9cc',
    go: '#00add8', rs: '#dea584', rb: '#cc342d', php: '#777bb4',
    html: '#e34f26', css: '#1572b6', scss: '#cf649a', json: '#fbbf24',
    md: '#083fa1', sql: '#e38c00', sh: '#89e051', yaml: '#cb171e',
    yml: '#cb171e', xml: '#f16529', svg: '#ffb13b',
  };
  return colors[ext] || '#94a3b8';
};

const TabBar = () => {
  const { state } = useIDE();
  const actions = useIDEActions();
  const { openTabs, activeTabId } = state;
  const [contextMenu, setContextMenu] = useState(null);
  const tabsRef = useRef(null);

  const handleContextMenu = (e, tab) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId: tab.id,
    });
  };

  const handleCloseContextMenu = () => setContextMenu(null);

  if (openTabs.length === 0) return null;

  return (
    <div className="tab-bar" ref={tabsRef}>
      <div className="tab-bar-scroll">
        <AnimatePresence mode="popLayout">
          {openTabs.map((tab) => {
            const Icon = getFileIcon(tab.name);
            const isActive = tab.id === activeTabId;
            const iconColor = getExtColor(tab.name);
            return (
              <motion.div
                key={tab.id}
                layout
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className={`tab ${isActive ? 'active' : ''} ${tab.isDirty ? 'dirty' : ''}`}
                onClick={() => actions.setActiveTab(tab.id)}
                onContextMenu={(e) => handleContextMenu(e, tab)}
                onMouseDown={(e) => {
                  if (e.button === 1) { // Middle click
                    e.preventDefault();
                    actions.closeTab(tab.id);
                  }
                }}
              >
                <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
                <span className="tab-name">{tab.name}</span>
                {tab.isDirty && <Circle size={8} className="tab-dirty-indicator" fill="currentColor" />}
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.closeTab(tab.id);
                  }}
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="context-menu-overlay" onClick={handleCloseContextMenu} />
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button onClick={() => { actions.closeTab(contextMenu.tabId); handleCloseContextMenu(); }}>
              Close
            </button>
            <button onClick={() => { actions.closeOtherTabs(contextMenu.tabId); handleCloseContextMenu(); }}>
              Close Others
            </button>
            <button onClick={() => { actions.closeAllTabs(); handleCloseContextMenu(); }}>
              Close All
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TabBar;
