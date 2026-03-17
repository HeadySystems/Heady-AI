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
// ║  FILE: HeadyAI-IDE/src/hooks/useCloudConnection.js               ║
// ║  LAYER: frontend/src/hooks                                       ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import { useEffect, useCallback, useRef } from 'react';
import cloudService from '../services/CloudService';
import { useIDEActions } from '../stores/ideStore';

export function useCloudConnection() {
  const actions = useIDEActions();
  const cleanupRef = useRef([]);

  useEffect(() => {
    // Connect on mount
    cloudService.connect();

    // Listen for connection status changes
    const unsub1 = cloudService.on('connection', (data) => {
      actions.setConnectionStatus(data.status);
      if (data.status === 'connected') {
        actions.addNotification({ type: 'success', message: 'Connected to HeadyAI Cloud', duration: 3000 });
      } else if (data.status === 'disconnected') {
        actions.addNotification({ type: 'warning', message: 'Disconnected from cloud - reconnecting...', duration: 5000 });
      }
    });

    // Listen for collaboration events
    const unsub2 = cloudService.on('collab:users', (data) => {
      actions.setCollaborators(data.payload?.users || []);
    });

    // Listen for git status updates
    const unsub3 = cloudService.on('git:status', (data) => {
      if (data.payload?.changes) actions.setGitChanges(data.payload.changes);
      if (data.payload?.branch) actions.setGitBranch(data.payload.branch);
    });

    // Listen for problem reports
    const unsub4 = cloudService.on('diagnostics', (data) => {
      if (data.payload?.problems) actions.setProblems(data.payload.problems);
    });

    cleanupRef.current = [unsub1, unsub2, unsub3, unsub4];

    return () => {
      cleanupRef.current.forEach(fn => fn());
      cloudService.disconnect();
    };
  }, []);

  return cloudService;
}

export function useKeyboardShortcuts() {
  const actions = useIDEActions();

  useEffect(() => {
    const handler = (e) => {
      // Ctrl+Shift+P / Cmd+Shift+P = Command Palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        actions.toggleCommandPalette();
      }
      // Ctrl+` / Cmd+` = Toggle Terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        actions.toggleBottomPanel();
      }
      // Ctrl+B / Cmd+B = Toggle Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        actions.toggleSidebar();
      }
      // Ctrl+S / Cmd+S = Save (prevent default, let editor handle)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Dispatch custom event for the editor to pick up
        window.dispatchEvent(new CustomEvent('heady:save'));
      }
      // Ctrl+W / Cmd+W = Close tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('heady:close-tab'));
      }
      // Ctrl+Shift+E = Explorer
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        actions.setActiveView('explorer');
      }
      // Ctrl+Shift+G = Git
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        actions.setActiveView('git');
      }
      // Ctrl+Shift+D = Debug
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        actions.setActiveView('debug');
      }
      // Ctrl+Shift+X = Extensions
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
        e.preventDefault();
        actions.setActiveView('extensions');
      }
      // Ctrl+Shift+I = AI chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        actions.toggleAIChat();
      }
      // Escape = Close command palette
      if (e.key === 'Escape') {
        actions.setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}
