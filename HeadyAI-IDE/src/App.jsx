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
// ║  FILE: HeadyAI-IDE/src/App.jsx                                   ║
// ║  LAYER: frontend/src                                             ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

<<<<<<< HEAD
import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// State management
import { IDEProvider, useIDE, useIDEActions, VIEWS, PANELS } from './stores/ideStore';

// Components
import ActivityBar from './components/ActivityBar';
import TabBar from './components/TabBar';
import Breadcrumbs from './components/Breadcrumbs';
import Editor from './components/Editor';
import FileExplorer from './components/FileExplorer';
import AIChat from './components/AIChat';
import SearchPanel from './components/SearchPanel';
import GitPanel from './components/GitPanel';
import CommandPalette from './components/CommandPalette';
import ModelSelector from './components/ModelSelector';
import SacredGeometryBackground from './components/SacredGeometryBackground';

// Cloud service
import { useCloudConnection } from './hooks/useCloudConnection';

const IDELayout = () => {
  const { state } = useIDE();
  const actions = useIDEActions();
  const cloud = useCloudConnection();

  const {
    activeView, sidebarOpen, openTabs, activeTabId,
    bottomPanelOpen, activeBottomPanel, bottomPanelHeight,
    commandPaletteOpen, aiChatOpen, selectedModel,
    connectionStatus, gitBranch, problems, outputLines,
  } = state;

  const activeTab = openTabs.find(t => t.id === activeTabId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Command Palette: Ctrl+Shift+P
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        actions.toggleCommandPalette();
      }
      // Toggle sidebar: Ctrl+B
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        actions.toggleSidebar();
      }
      // Toggle terminal: Ctrl+`
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        actions.toggleBottomPanel();
      }
      // Toggle AI: Ctrl+Shift+I
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        actions.toggleAIChat();
      }
      // Save: Ctrl+S
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (activeTab && activeTab.isDirty) {
          cloud.saveFile(activeTab.path, activeTab.content);
          actions.markTabSaved(activeTab.id);
        }
      }
      // Close tab: Ctrl+W
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) actions.closeTab(activeTabId);
      }
      // Explorer: Ctrl+Shift+E
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        actions.setActiveView(VIEWS.EXPLORER);
      }
      // Search: Ctrl+Shift+F
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        actions.setActiveView(VIEWS.SEARCH);
      }
      // Git: Ctrl+Shift+G
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        actions.setActiveView(VIEWS.GIT);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actions, activeTab, activeTabId, cloud]);

  // Render sidebar content based on active view
  const renderSidebarContent = () => {
    switch (activeView) {
      case VIEWS.EXPLORER:
        return <FileExplorer files={[]} onFileSelect={(f) => actions.openTab(f)} activeFile={activeTab} />;
      case VIEWS.SEARCH:
        return <SearchPanel />;
      case VIEWS.GIT:
        return <GitPanel />;
      case VIEWS.AI:
        return <AIChat model={selectedModel} activeFile={activeTab} onClose={() => actions.setActiveView(VIEWS.EXPLORER)} />;
      case VIEWS.EXTENSIONS:
        return (
          <div className="panel-content">
            <h3 className="panel-title">Extensions</h3>
            <div className="extensions-search">
              <input type="text" placeholder="Search extensions..." className="search-input" />
            </div>
            <div className="extensions-list">
              {[
                { name: 'Heady Python', desc: 'Python language support', installed: true },
                { name: 'Heady TypeScript', desc: 'TypeScript tooling', installed: true },
                { name: 'Sacred Themes', desc: 'Sacred Geometry color themes', installed: true },
                { name: 'Heady Rust', desc: 'Rust analyzer integration', installed: false },
                { name: 'Heady Docker', desc: 'Docker & container support', installed: false },
                { name: 'Heady K8s', desc: 'Kubernetes manifests', installed: false },
              ].map((ext, i) => (
                <div key={i} className="extension-item">
                  <div className="ext-info">
                    <span className="ext-name">{ext.name}</span>
                    <span className="ext-desc">{ext.desc}</span>
                  </div>
                  <button className={`ext-btn ${ext.installed ? 'installed' : ''}`}>
                    {ext.installed ? 'Installed' : 'Install'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case VIEWS.DEBUG:
        return (
          <div className="panel-content">
            <h3 className="panel-title">Run & Debug</h3>
            <button className="debug-start-btn">Start Debugging (F5)</button>
            <div className="debug-section">
              <h4>Breakpoints</h4>
              <div className="debug-empty">No breakpoints set</div>
            </div>
            <div className="debug-section">
              <h4>Watch</h4>
              <div className="debug-empty">Add watch expressions</div>
            </div>
            <div className="debug-section">
              <h4>Call Stack</h4>
              <div className="debug-empty">Not running</div>
            </div>
          </div>
        );
      case VIEWS.SETTINGS:
        return (
          <div className="panel-content">
            <h3 className="panel-title">Settings</h3>
            <div className="settings-list">
              <div className="setting-item">
                <label>Font Size</label>
                <input type="number" defaultValue={13} min={8} max={34}
                  onChange={(e) => actions.updateEditorSettings({ fontSize: parseInt(e.target.value) })} />
              </div>
              <div className="setting-item">
                <label>Tab Size</label>
                <select defaultValue="2" onChange={(e) => actions.updateEditorSettings({ tabSize: parseInt(e.target.value) })}>
                  <option value="2">2 spaces</option>
                  <option value="4">4 spaces</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Minimap</label>
                <input type="checkbox" defaultChecked onChange={(e) => actions.updateEditorSettings({ minimap: e.target.checked })} />
              </div>
              <div className="setting-item">
                <label>Word Wrap</label>
                <select defaultValue="off" onChange={(e) => actions.updateEditorSettings({ wordWrap: e.target.value })}>
                  <option value="off">Off</option>
                  <option value="on">On</option>
                  <option value="wordWrapColumn">Column</option>
                </select>
              </div>
              <div className="setting-item">
                <label>AI Model</label>
                <ModelSelector selectedModel={selectedModel} onModelChange={(m) => actions.setSelectedModel(m)} />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="ide-container">
      <SacredGeometryBackground />

      {/* Command Palette Overlay */}
      <AnimatePresence>
        {commandPaletteOpen && <CommandPalette />}
      </AnimatePresence>

      <div className="ide-layout">
        {/* Activity Bar (leftmost icons) */}
        <ActivityBar />

        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              className="ide-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderSidebarContent()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="ide-main">
          {/* Tab Bar */}
          <TabBar />

          {/* Breadcrumbs */}
          {activeTab && <Breadcrumbs />}

          {/* Editor Area */}
          <div className="ide-editor-area">
            {activeTab ? (
              <Editor
                file={activeTab}
                onFileChange={(content) => {
                  if (activeTab) actions.updateTabContent(activeTab.id, content);
                }}
              />
            ) : (
              <div className="ide-welcome">
                <div className="welcome-logo">
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
                  >
                    <svg viewBox="0 0 100 100" width="80" height="80">
                      <defs>
                        <linearGradient id="wg" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#0EA5E9" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                      <polygon points="50,8 88,28 88,72 50,92 12,72 12,28" fill="none" stroke="url(#wg)" strokeWidth="3" />
                      <circle cx="50" cy="50" r="10" fill="url(#wg)" />
                    </svg>
                  </motion.div>
                </div>
                <h1 className="welcome-title">HeadyAI-IDE</h1>
                <p className="welcome-subtitle">Cloud-First AI Development Environment</p>
                <div className="welcome-shortcuts">
                  <div className="shortcut-item"><kbd>Ctrl+Shift+P</kbd><span>Command Palette</span></div>
                  <div className="shortcut-item"><kbd>Ctrl+Shift+E</kbd><span>Explorer</span></div>
                  <div className="shortcut-item"><kbd>Ctrl+Shift+F</kbd><span>Search</span></div>
                  <div className="shortcut-item"><kbd>Ctrl+Shift+I</kbd><span>AI Chat</span></div>
                  <div className="shortcut-item"><kbd>Ctrl+`</kbd><span>Terminal</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel (Terminal/Output/Problems) */}
          <AnimatePresence>
            {bottomPanelOpen && (
              <motion.div
                className="ide-bottom-panel"
                initial={{ height: 0 }}
                animate={{ height: bottomPanelHeight }}
                exit={{ height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bottom-panel-tabs">
                  {[
                    { id: PANELS.TERMINAL, label: 'Terminal' },
                    { id: PANELS.OUTPUT, label: 'Output' },
                    { id: PANELS.PROBLEMS, label: `Problems (${problems.length})` },
                    { id: PANELS.DEBUG_CONSOLE, label: 'Debug Console' },
                  ].map(panel => (
                    <button
                      key={panel.id}
                      className={`bottom-tab ${activeBottomPanel === panel.id ? 'active' : ''}`}
                      onClick={() => actions.setActiveBottomPanel(panel.id)}
                    >
                      {panel.label}
                    </button>
                  ))}
                  <div className="bottom-panel-spacer" />
                  <button className="bottom-panel-close" onClick={() => actions.toggleBottomPanel()}>✕</button>
                </div>
                <div className="bottom-panel-content">
                  {activeBottomPanel === PANELS.TERMINAL && (
                    <div className="terminal-content">
                      <div className="terminal-line">
                        <span className="terminal-prompt">heady@cloud:~$</span>
                        <span className="terminal-cursor">_</span>
                      </div>
                      <div className="terminal-info">
                        Connected to Heady Cloud Compute • {connectionStatus}
                      </div>
                    </div>
                  )}
                  {activeBottomPanel === PANELS.OUTPUT && (
                    <div className="output-content">
                      {outputLines.length === 0
                        ? <div className="output-empty">No output</div>
                        : outputLines.map((line, i) => <div key={i} className="output-line">{line}</div>)
                      }
                    </div>
                  )}
                  {activeBottomPanel === PANELS.PROBLEMS && (
                    <div className="problems-content">
                      {problems.length === 0
                        ? <div className="problems-empty">No problems detected</div>
                        : problems.map((p, i) => (
                          <div key={i} className={`problem-item ${p.severity}`}>
                            <span className="problem-icon">{p.severity === 'error' ? '✗' : '⚠'}</span>
                            <span className="problem-msg">{p.message}</span>
                            <span className="problem-file">{p.file}:{p.line}</span>
                          </div>
                        ))
                      }
                    </div>
                  )}
                  {activeBottomPanel === PANELS.DEBUG_CONSOLE && (
                    <div className="debug-console-content">
                      <div className="debug-console-empty">Debug console ready</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* AI Chat Panel (right side) */}
        <AnimatePresence>
          {aiChatOpen && (
            <motion.div
              className="ide-ai-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AIChat
                model={selectedModel}
                onClose={() => actions.toggleAIChat()}
                activeFile={activeTab}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status Bar */}
      <div className="ide-status-bar">
        <div className="status-left">
          <span className={`status-connection ${connectionStatus}`}>
            {connectionStatus === 'connected' ? '⬤' : '◯'} Cloud
          </span>
          <span className="status-branch">⎇ {gitBranch}</span>
        </div>
        <div className="status-center">
          <span className="status-info">HeadyAI-IDE v1.0.0 • Liquid Lattice Omega</span>
        </div>
        <div className="status-right">
          {activeTab && <span className="status-lang">{activeTab.name?.split('.').pop()?.toUpperCase() || 'TEXT'}</span>}
          <span className="status-encoding">UTF-8</span>
          <span className="status-model">🧠 {selectedModel}</span>
        </div>
=======
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Code, Folder, Settings, Sparkles } from 'lucide-react';

// Components
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import FileExplorer from './components/FileExplorer';
import AIChat from './components/AIChat';
import ModelSelector from './components/ModelSelector';
import SacredGeometryBackground from './components/SacredGeometryBackground';

const App = () => {
  const [activeFile, setActiveFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState('heady-brain');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiChatOpen, setAiChatOpen] = useState(true);

  useEffect(() => {
    // Initialize with welcome file
    const welcomeFile = {
      name: 'Welcome to HeadyAI-IDE',
      path: '/welcome.md',
      content: `# Welcome to HeadyAI-IDE 🧠

## Next Generation AI-Powered Development Environment

HeadyAI-IDE integrates the power of Heady AI models directly into your development workflow.

### Features:
- 🧠 **Heady Brain Integration** - Advanced AI assistance
- 🎨 **Sacred Geometry UI** - Beautiful, organic interface
- ⚡ **Real-time Collaboration** - Work with AI seamlessly
- 📁 **Smart File Management** - Intelligent project organization
- 🔧 **Extensible Architecture** - Plugin-based system

### Getting Started:
1. Select an AI model from the dropdown
2. Open or create a file
3. Start coding with AI assistance
4. Enjoy the sacred geometry experience!

### Available Models:
- **Heady Brain** - Primary Heady AI model
- **Heady Conductor** - Task orchestration
- **Heady Pattern** - Code pattern recognition
- **Heady Critique** - Code review and analysis

---
*Built with ❤️ by HeadySystems*`
    };
    setFiles([welcomeFile]);
    setActiveFile(welcomeFile);
  }, []);

  const handleFileSelect = (file) => {
    setActiveFile(file);
  };

  const handleModelChange = (model) => {
    setSelectedModel(model);
  };

  return (
    <div className="app-container">
      <SacredGeometryBackground />
      
      <div className="main-layout">
        {/* Sidebar */}
        <Sidebar 
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        >
          <div className="sidebar-content">
            <div className="logo-section">
              <Brain className="logo-icon" size={32} />
              <h1>HeadyAI-IDE</h1>
            </div>
            
            <ModelSelector 
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
            />
            
            <FileExplorer 
              files={files}
              onFileSelect={handleFileSelect}
              activeFile={activeFile}
            />
          </div>
        </Sidebar>

        {/* Main Content Area */}
        <div className="main-content">
          <header className="app-header">
            <div className="header-left">
              <Code className="header-icon" size={20} />
              <h2>HeadyAI Development Environment</h2>
            </div>
            <div className="header-right">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="ai-toggle-btn"
                onClick={() => setAiChatOpen(!aiChatOpen)}
              >
                <Sparkles size={16} />
                AI Assistant
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="settings-btn"
              >
                <Settings size={16} />
              </motion.button>
            </div>
          </header>

          <div className="content-area">
            <Editor 
              file={activeFile}
              onFileChange={(content) => {
                if (activeFile) {
                  setActiveFile({ ...activeFile, content });
                  setFiles(files.map(f => 
                    f.path === activeFile.path 
                      ? { ...f, content }
                      : f
                  ));
                }
              }}
            />
          </div>
        </div>

        {/* AI Chat Panel */}
        {aiChatOpen && (
          <AIChat 
            model={selectedModel}
            onClose={() => setAiChatOpen(false)}
            activeFile={activeFile}
          />
        )}
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
      </div>
    </div>
  );
};

<<<<<<< HEAD
const App = () => {
  return (
    <IDEProvider>
      <IDELayout />
    </IDEProvider>
  );
};

=======
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
export default App;
