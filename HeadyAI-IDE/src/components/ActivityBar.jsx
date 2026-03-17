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
// ║  FILE: HeadyAI-IDE/src/components/ActivityBar.jsx                ║
// ║  LAYER: frontend/src/components                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React from 'react';
import { motion } from 'framer-motion';
import {
  Files, Search, GitBranch, Bug, Puzzle, Brain, Settings,
  Sparkles, Users, Cloud, CloudOff
} from 'lucide-react';
import { useIDE, useIDEActions, VIEWS } from '../stores/ideStore';

const activityItems = [
  { id: VIEWS.EXPLORER, icon: Files, label: 'Explorer', shortcut: 'Ctrl+Shift+E' },
  { id: VIEWS.SEARCH, icon: Search, label: 'Search', shortcut: 'Ctrl+Shift+F' },
  { id: VIEWS.GIT, icon: GitBranch, label: 'Source Control', shortcut: 'Ctrl+Shift+G' },
  { id: VIEWS.DEBUG, icon: Bug, label: 'Run & Debug', shortcut: 'Ctrl+Shift+D' },
  { id: VIEWS.EXTENSIONS, icon: Puzzle, label: 'Extensions', shortcut: 'Ctrl+Shift+X' },
  { id: VIEWS.AI, icon: Brain, label: 'HeadyAI', shortcut: 'Ctrl+Shift+I' },
];

const bottomItems = [
  { id: VIEWS.SETTINGS, icon: Settings, label: 'Settings' },
];

const ActivityBar = () => {
  const { state } = useIDE();
  const actions = useIDEActions();
  const { activeView, connectionStatus, collaborators } = state;

  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        {/* Heady logo */}
        <div className="activity-bar-logo">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 21, repeat: Infinity, ease: 'linear' }}
            className="logo-spinner"
          >
            <Sparkles size={20} />
          </motion.div>
        </div>

        {/* Main navigation items */}
        {activityItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              className={`activity-bar-item ${isActive ? 'active' : ''}`}
              onClick={() => actions.setActiveView(item.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={`${item.label} (${item.shortcut})`}
            >
              <Icon size={22} />
              {isActive && (
                <motion.div
                  className="activity-bar-indicator"
                  layoutId="activeIndicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="activity-bar-bottom">
        {/* Collaborators indicator */}
        {collaborators.length > 0 && (
          <button className="activity-bar-item collab-indicator" title={`${collaborators.length} collaborator(s) online`}>
            <Users size={20} />
            <span className="collab-count">{collaborators.length}</span>
          </button>
        )}

        {/* Connection status */}
        <button
          className={`activity-bar-item connection-status ${connectionStatus}`}
          title={`Cloud: ${connectionStatus}`}
        >
          {connectionStatus === 'connected' ? <Cloud size={20} /> : <CloudOff size={20} />}
        </button>

        {/* Settings */}
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <motion.button
              key={item.id}
              className={`activity-bar-item ${isActive ? 'active' : ''}`}
              onClick={() => actions.setActiveView(item.id)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={item.label}
            >
              <Icon size={22} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityBar;
