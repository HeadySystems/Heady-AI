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
// ║  FILE: HeadyAI-IDE/src/stores/ideStore.js                        ║
// ║  LAYER: frontend/src/stores                                      ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Activity bar views
export const VIEWS = {
  EXPLORER: 'explorer',
  SEARCH: 'search',
  GIT: 'git',
  DEBUG: 'debug',
  EXTENSIONS: 'extensions',
  AI: 'ai',
  SETTINGS: 'settings',
};

// Bottom panel tabs
export const PANELS = {
  TERMINAL: 'terminal',
  OUTPUT: 'output',
  PROBLEMS: 'problems',
  DEBUG_CONSOLE: 'debug-console',
};

const initialState = {
  // Activity bar
  activeView: VIEWS.EXPLORER,
  sidebarOpen: true,

  // Files & tabs
  openTabs: [],
  activeTabId: null,
  fileTree: null,
  workspacePath: '/workspace',

  // Editor
  splitPanes: [{ id: 'main', tabs: [], activeTabId: null }],
  editorSettings: {
    fontSize: 13,
    fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
    minimap: true,
    wordWrap: 'off',
    tabSize: 2,
    theme: 'heady-dark',
    bracketPairColorization: true,
    guides: true,
    renderWhitespace: 'selection',
    lineNumbers: 'on',
    smoothScrolling: true,
  },

  // AI
  selectedModel: 'heady-brain',
  aiChatOpen: false,
  aiMessages: [],

  // Bottom panel
  bottomPanelOpen: true,
  bottomPanelHeight: 250,
  activeBottomPanel: PANELS.TERMINAL,

  // Command palette
  commandPaletteOpen: false,

  // Git
  gitChanges: [],
  gitBranch: 'main',
  gitBranches: [],

  // Debug
  breakpoints: [],
  watchExpressions: [],
  callStack: [],
  debugState: 'idle', // idle, running, paused, stopped

  // Problems / Output
  problems: [],
  outputLines: [],

  // Extensions
  installedExtensions: [],
  extensionSearch: '',

  // Collaboration
  collaborators: [],
  connectionStatus: 'disconnected',

  // Settings
  settingsOpen: false,

  // Notifications
  notifications: [],
};

function ideReducer(state, action) {
  switch (action.type) {
    // View management
    case 'SET_ACTIVE_VIEW':
      return {
        ...state,
        activeView: action.payload,
        sidebarOpen: state.activeView === action.payload ? !state.sidebarOpen : true,
      };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    // Tab management
    case 'OPEN_TAB': {
      const existingTab = state.openTabs.find(t => t.path === action.payload.path);
      if (existingTab) {
        return { ...state, activeTabId: existingTab.id };
      }
      const newTab = {
        id: `tab-${Date.now()}`,
        ...action.payload,
        isDirty: false,
        originalContent: action.payload.content,
      };
      return {
        ...state,
        openTabs: [...state.openTabs, newTab],
        activeTabId: newTab.id,
      };
    }
    case 'CLOSE_TAB': {
      const tabs = state.openTabs.filter(t => t.id !== action.payload);
      let activeTabId = state.activeTabId;
      if (activeTabId === action.payload) {
        const idx = state.openTabs.findIndex(t => t.id === action.payload);
        activeTabId = tabs[Math.min(idx, tabs.length - 1)]?.id || null;
      }
      return { ...state, openTabs: tabs, activeTabId };
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTabId: action.payload };
    case 'UPDATE_TAB_CONTENT': {
      return {
        ...state,
        openTabs: state.openTabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, content: action.payload.content, isDirty: action.payload.content !== t.originalContent }
            : t
        ),
      };
    }
    case 'MARK_TAB_SAVED': {
      return {
        ...state,
        openTabs: state.openTabs.map(t =>
          t.id === action.payload
            ? { ...t, isDirty: false, originalContent: t.content }
            : t
        ),
      };
    }
    case 'CLOSE_ALL_TABS':
      return { ...state, openTabs: [], activeTabId: null };
    case 'CLOSE_OTHER_TABS':
      return {
        ...state,
        openTabs: state.openTabs.filter(t => t.id === action.payload),
        activeTabId: action.payload,
      };

    // File tree
    case 'SET_FILE_TREE':
      return { ...state, fileTree: action.payload };
    case 'SET_WORKSPACE_PATH':
      return { ...state, workspacePath: action.payload };

    // AI
    case 'SET_SELECTED_MODEL':
      return { ...state, selectedModel: action.payload };
    case 'TOGGLE_AI_CHAT':
      return { ...state, aiChatOpen: !state.aiChatOpen };
    case 'SET_AI_CHAT_OPEN':
      return { ...state, aiChatOpen: action.payload };
    case 'ADD_AI_MESSAGE':
      return { ...state, aiMessages: [...state.aiMessages, action.payload] };
    case 'CLEAR_AI_MESSAGES':
      return { ...state, aiMessages: [] };

    // Bottom panel
    case 'TOGGLE_BOTTOM_PANEL':
      return { ...state, bottomPanelOpen: !state.bottomPanelOpen };
    case 'SET_BOTTOM_PANEL_OPEN':
      return { ...state, bottomPanelOpen: action.payload };
    case 'SET_ACTIVE_BOTTOM_PANEL':
      return { ...state, activeBottomPanel: action.payload, bottomPanelOpen: true };
    case 'SET_BOTTOM_PANEL_HEIGHT':
      return { ...state, bottomPanelHeight: action.payload };

    // Command palette
    case 'TOGGLE_COMMAND_PALETTE':
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };
    case 'SET_COMMAND_PALETTE_OPEN':
      return { ...state, commandPaletteOpen: action.payload };

    // Git
    case 'SET_GIT_CHANGES':
      return { ...state, gitChanges: action.payload };
    case 'SET_GIT_BRANCH':
      return { ...state, gitBranch: action.payload };
    case 'SET_GIT_BRANCHES':
      return { ...state, gitBranches: action.payload };

    // Debug
    case 'SET_DEBUG_STATE':
      return { ...state, debugState: action.payload };
    case 'SET_BREAKPOINTS':
      return { ...state, breakpoints: action.payload };
    case 'ADD_BREAKPOINT':
      return { ...state, breakpoints: [...state.breakpoints, action.payload] };
    case 'REMOVE_BREAKPOINT':
      return {
        ...state,
        breakpoints: state.breakpoints.filter(bp =>
          !(bp.file === action.payload.file && bp.line === action.payload.line)
        ),
      };
    case 'SET_WATCH_EXPRESSIONS':
      return { ...state, watchExpressions: action.payload };
    case 'SET_CALL_STACK':
      return { ...state, callStack: action.payload };

    // Problems / Output
    case 'SET_PROBLEMS':
      return { ...state, problems: action.payload };
    case 'ADD_PROBLEM':
      return { ...state, problems: [...state.problems, action.payload] };
    case 'ADD_OUTPUT_LINE':
      return { ...state, outputLines: [...state.outputLines, action.payload] };
    case 'CLEAR_OUTPUT':
      return { ...state, outputLines: [] };

    // Extensions
    case 'SET_INSTALLED_EXTENSIONS':
      return { ...state, installedExtensions: action.payload };
    case 'SET_EXTENSION_SEARCH':
      return { ...state, extensionSearch: action.payload };

    // Collaboration
    case 'SET_COLLABORATORS':
      return { ...state, collaborators: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };

    // Settings
    case 'TOGGLE_SETTINGS':
      return { ...state, settingsOpen: !state.settingsOpen };
    case 'UPDATE_EDITOR_SETTINGS':
      return { ...state, editorSettings: { ...state.editorSettings, ...action.payload } };

    // Notifications
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, { id: Date.now(), ...action.payload }],
      };
    case 'DISMISS_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };

    default:
      return state;
  }
}

const IDEContext = createContext(null);

export function IDEProvider({ children }) {
  const [state, dispatch] = useReducer(ideReducer, initialState);

  return (
    <IDEContext.Provider value={{ state, dispatch }}>
      {children}
    </IDEContext.Provider>
  );
}

export function useIDE() {
  const context = useContext(IDEContext);
  if (!context) {
    throw new Error('useIDE must be used within IDEProvider');
  }
  return context;
}

export function useIDEActions() {
  const { dispatch } = useIDE();

  return {
    setActiveView: useCallback((view) => dispatch({ type: 'SET_ACTIVE_VIEW', payload: view }), [dispatch]),
    toggleSidebar: useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), [dispatch]),
    openTab: useCallback((tab) => dispatch({ type: 'OPEN_TAB', payload: tab }), [dispatch]),
    closeTab: useCallback((tabId) => dispatch({ type: 'CLOSE_TAB', payload: tabId }), [dispatch]),
    setActiveTab: useCallback((tabId) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId }), [dispatch]),
    updateTabContent: useCallback((tabId, content) => dispatch({ type: 'UPDATE_TAB_CONTENT', payload: { tabId, content } }), [dispatch]),
    markTabSaved: useCallback((tabId) => dispatch({ type: 'MARK_TAB_SAVED', payload: tabId }), [dispatch]),
    closeAllTabs: useCallback(() => dispatch({ type: 'CLOSE_ALL_TABS' }), [dispatch]),
    closeOtherTabs: useCallback((tabId) => dispatch({ type: 'CLOSE_OTHER_TABS', payload: tabId }), [dispatch]),
    setFileTree: useCallback((tree) => dispatch({ type: 'SET_FILE_TREE', payload: tree }), [dispatch]),
    setSelectedModel: useCallback((model) => dispatch({ type: 'SET_SELECTED_MODEL', payload: model }), [dispatch]),
    toggleAIChat: useCallback(() => dispatch({ type: 'TOGGLE_AI_CHAT' }), [dispatch]),
    setAIChatOpen: useCallback((open) => dispatch({ type: 'SET_AI_CHAT_OPEN', payload: open }), [dispatch]),
    addAIMessage: useCallback((msg) => dispatch({ type: 'ADD_AI_MESSAGE', payload: msg }), [dispatch]),
    toggleBottomPanel: useCallback(() => dispatch({ type: 'TOGGLE_BOTTOM_PANEL' }), [dispatch]),
    setActiveBottomPanel: useCallback((panel) => dispatch({ type: 'SET_ACTIVE_BOTTOM_PANEL', payload: panel }), [dispatch]),
    setBottomPanelHeight: useCallback((h) => dispatch({ type: 'SET_BOTTOM_PANEL_HEIGHT', payload: h }), [dispatch]),
    toggleCommandPalette: useCallback(() => dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }), [dispatch]),
    setGitChanges: useCallback((c) => dispatch({ type: 'SET_GIT_CHANGES', payload: c }), [dispatch]),
    setGitBranch: useCallback((b) => dispatch({ type: 'SET_GIT_BRANCH', payload: b }), [dispatch]),
    setGitBranches: useCallback((b) => dispatch({ type: 'SET_GIT_BRANCHES', payload: b }), [dispatch]),
    setDebugState: useCallback((s) => dispatch({ type: 'SET_DEBUG_STATE', payload: s }), [dispatch]),
    addBreakpoint: useCallback((bp) => dispatch({ type: 'ADD_BREAKPOINT', payload: bp }), [dispatch]),
    removeBreakpoint: useCallback((bp) => dispatch({ type: 'REMOVE_BREAKPOINT', payload: bp }), [dispatch]),
    setProblems: useCallback((p) => dispatch({ type: 'SET_PROBLEMS', payload: p }), [dispatch]),
    addOutputLine: useCallback((line) => dispatch({ type: 'ADD_OUTPUT_LINE', payload: line }), [dispatch]),
    clearOutput: useCallback(() => dispatch({ type: 'CLEAR_OUTPUT' }), [dispatch]),
    setInstalledExtensions: useCallback((e) => dispatch({ type: 'SET_INSTALLED_EXTENSIONS', payload: e }), [dispatch]),
    setCollaborators: useCallback((c) => dispatch({ type: 'SET_COLLABORATORS', payload: c }), [dispatch]),
    setConnectionStatus: useCallback((s) => dispatch({ type: 'SET_CONNECTION_STATUS', payload: s }), [dispatch]),
    toggleSettings: useCallback(() => dispatch({ type: 'TOGGLE_SETTINGS' }), [dispatch]),
    updateEditorSettings: useCallback((s) => dispatch({ type: 'UPDATE_EDITOR_SETTINGS', payload: s }), [dispatch]),
    addNotification: useCallback((n) => dispatch({ type: 'ADD_NOTIFICATION', payload: n }), [dispatch]),
    dismissNotification: useCallback((id) => dispatch({ type: 'DISMISS_NOTIFICATION', payload: id }), [dispatch]),
  };
}
