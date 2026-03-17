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
// ║  FILE: HeadyAI-IDE/src/components/CommandPalette.jsx             ║
// ║  LAYER: frontend/src/components                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Files, GitBranch, Bug, Puzzle, Brain, Settings,
  Terminal, Plus, Save, FolderOpen, Palette, RotateCcw,
  Columns, PanelBottom, Sparkles, Keyboard, RefreshCw,
  Code, Zap, Play, BookOpen
} from 'lucide-react';
import { useIDE, useIDEActions, VIEWS, PANELS } from '../stores/ideStore';

const allCommands = [
  { id: 'file.new', label: 'New File', icon: Plus, category: 'File', shortcut: 'Ctrl+N' },
  { id: 'file.open', label: 'Open File', icon: FolderOpen, category: 'File', shortcut: 'Ctrl+O' },
  { id: 'file.save', label: 'Save', icon: Save, category: 'File', shortcut: 'Ctrl+S' },
  { id: 'file.saveAll', label: 'Save All', icon: Save, category: 'File', shortcut: 'Ctrl+Shift+S' },
  { id: 'view.explorer', label: 'Show Explorer', icon: Files, category: 'View', shortcut: 'Ctrl+Shift+E' },
  { id: 'view.search', label: 'Show Search', icon: Search, category: 'View', shortcut: 'Ctrl+Shift+F' },
  { id: 'view.git', label: 'Show Source Control', icon: GitBranch, category: 'View', shortcut: 'Ctrl+Shift+G' },
  { id: 'view.debug', label: 'Show Debug', icon: Bug, category: 'View', shortcut: 'Ctrl+Shift+D' },
  { id: 'view.extensions', label: 'Show Extensions', icon: Puzzle, category: 'View', shortcut: 'Ctrl+Shift+X' },
  { id: 'view.ai', label: 'Show HeadyAI Chat', icon: Brain, category: 'View', shortcut: 'Ctrl+Shift+I' },
  { id: 'view.settings', label: 'Open Settings', icon: Settings, category: 'View' },
  { id: 'view.terminal', label: 'Toggle Terminal', icon: Terminal, category: 'View', shortcut: 'Ctrl+`' },
  { id: 'view.sidebar', label: 'Toggle Sidebar', icon: Columns, category: 'View', shortcut: 'Ctrl+B' },
  { id: 'view.panel', label: 'Toggle Bottom Panel', icon: PanelBottom, category: 'View' },
  { id: 'editor.splitRight', label: 'Split Editor Right', icon: Columns, category: 'Editor' },
  { id: 'editor.toggleMinimap', label: 'Toggle Minimap', icon: Code, category: 'Editor' },
  { id: 'editor.wordWrap', label: 'Toggle Word Wrap', icon: RotateCcw, category: 'Editor' },
  { id: 'editor.format', label: 'Format Document', icon: Palette, category: 'Editor', shortcut: 'Shift+Alt+F' },
  { id: 'ai.explain', label: 'AI: Explain Code', icon: BookOpen, category: 'AI' },
  { id: 'ai.refactor', label: 'AI: Refactor Code', icon: RefreshCw, category: 'AI' },
  { id: 'ai.bugs', label: 'AI: Detect Bugs', icon: Bug, category: 'AI' },
  { id: 'ai.tests', label: 'AI: Generate Tests', icon: Zap, category: 'AI' },
  { id: 'ai.complete', label: 'AI: Trigger Completion', icon: Sparkles, category: 'AI' },
  { id: 'debug.start', label: 'Start Debugging', icon: Play, category: 'Debug', shortcut: 'F5' },
  { id: 'debug.stop', label: 'Stop Debugging', icon: Bug, category: 'Debug', shortcut: 'Shift+F5' },
  { id: 'terminal.new', label: 'New Terminal', icon: Terminal, category: 'Terminal' },
  { id: 'keyboard.shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, category: 'Help' },
];

const CommandPalette = () => {
  const { state } = useIDE();
  const actions = useIDEActions();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands;
    const q = query.toLowerCase();
    return allCommands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (state.commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [state.commandPaletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeCommand = (cmd) => {
    actions.setCommandPaletteOpen(false);
    switch (cmd.id) {
      case 'view.explorer': actions.setActiveView(VIEWS.EXPLORER); break;
      case 'view.search': actions.setActiveView(VIEWS.SEARCH); break;
      case 'view.git': actions.setActiveView(VIEWS.GIT); break;
      case 'view.debug': actions.setActiveView(VIEWS.DEBUG); break;
      case 'view.extensions': actions.setActiveView(VIEWS.EXTENSIONS); break;
      case 'view.ai': actions.toggleAIChat(); break;
      case 'view.settings': actions.setActiveView(VIEWS.SETTINGS); break;
      case 'view.terminal': actions.setActiveBottomPanel(PANELS.TERMINAL); break;
      case 'view.sidebar': actions.toggleSidebar(); break;
      case 'view.panel': actions.toggleBottomPanel(); break;
      case 'file.save': window.dispatchEvent(new CustomEvent('heady:save')); break;
      case 'editor.toggleMinimap':
        actions.updateEditorSettings({ minimap: !state.editorSettings.minimap });
        break;
      case 'editor.wordWrap':
        actions.updateEditorSettings({
          wordWrap: state.editorSettings.wordWrap === 'on' ? 'off' : 'on'
        });
        break;
      case 'ai.explain': window.dispatchEvent(new CustomEvent('heady:ai-action', { detail: 'explain' })); break;
      case 'ai.refactor': window.dispatchEvent(new CustomEvent('heady:ai-action', { detail: 'refactor' })); break;
      case 'ai.bugs': window.dispatchEvent(new CustomEvent('heady:ai-action', { detail: 'detect-bugs' })); break;
      case 'ai.tests': window.dispatchEvent(new CustomEvent('heady:ai-action', { detail: 'generate-tests' })); break;
      default: break;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      executeCommand(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      actions.setCommandPaletteOpen(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!state.commandPaletteOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="command-palette-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => actions.setCommandPaletteOpen(false)}
      >
        <motion.div
          className="command-palette"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="command-palette-input">
            <Search size={16} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div className="command-palette-list" ref={listRef}>
            {filtered.map((cmd, index) => {
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="command-item-left">
                    <Icon size={16} />
                    <span className="command-label">{cmd.label}</span>
                    <span className="command-category">{cmd.category}</span>
                  </div>
                  {cmd.shortcut && (
                    <span className="command-shortcut">{cmd.shortcut}</span>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="command-palette-empty">No matching commands</div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CommandPalette;
