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
// ║  FILE: HeadyAI-IDE/src/components/GitPanel.jsx                   ║
// ║  LAYER: frontend/src/components                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, GitCommit, GitPullRequest, Plus, Minus,
  RefreshCw, Check, Upload, Download, ChevronDown,
  ChevronRight, File, RotateCcw, Eye
} from 'lucide-react';
import cloudService from '../services/CloudService';
import { useIDE, useIDEActions } from '../stores/ideStore';

const statusIcons = {
  modified: { icon: 'M', color: '#e2b714' },
  added: { icon: 'A', color: '#73c991' },
  deleted: { icon: 'D', color: '#f14c4c' },
  renamed: { icon: 'R', color: '#73c991' },
  untracked: { icon: 'U', color: '#73c991' },
  conflicted: { icon: 'C', color: '#f14c4c' },
};

const GitPanel = () => {
  const { state } = useIDE();
  const actions = useIDEActions();
  const { gitChanges, gitBranch, gitBranches } = state;
  const [commitMessage, setCommitMessage] = useState('');
  const [stagedFiles, setStagedFiles] = useState([]);
  const [showBranches, setShowBranches] = useState(false);
  const [expandStaged, setExpandStaged] = useState(true);
  const [expandUnstaged, setExpandUnstaged] = useState(true);
  const [loading, setLoading] = useState(false);

  const refreshGitStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await cloudService.gitStatus();
      actions.setGitChanges(status?.changes || []);
      actions.setGitBranch(status?.branch || 'main');
      const branches = await cloudService.gitBranches();
      actions.setGitBranches(branches?.branches || []);
    } catch {
      // Offline fallback
      actions.setGitChanges([
        { file: 'src/App.jsx', status: 'modified', staged: false },
        { file: 'src/components/Editor.jsx', status: 'modified', staged: false },
        { file: 'src/components/Terminal.jsx', status: 'added', staged: true },
      ]);
    } finally {
      setLoading(false);
    }
  }, [actions]);

  useEffect(() => {
    refreshGitStatus();
    const interval = setInterval(refreshGitStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [refreshGitStatus]);

  const stageFile = async (file) => {
    try {
      await cloudService.gitStage([file]);
      refreshGitStatus();
    } catch {
      actions.setGitChanges(
        gitChanges.map(c => c.file === file ? { ...c, staged: true } : c)
      );
    }
  };

  const unstageFile = async (file) => {
    try {
      await cloudService.gitUnstage([file]);
      refreshGitStatus();
    } catch {
      actions.setGitChanges(
        gitChanges.map(c => c.file === file ? { ...c, staged: false } : c)
      );
    }
  };

  const commit = async () => {
    if (!commitMessage.trim()) return;
    setLoading(true);
    try {
      const staged = gitChanges.filter(c => c.staged).map(c => c.file);
      await cloudService.gitCommit(commitMessage, staged);
      setCommitMessage('');
      refreshGitStatus();
      actions.addNotification({ type: 'success', message: 'Committed successfully' });
    } catch (e) {
      actions.addNotification({ type: 'error', message: `Commit failed: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const pull = async () => {
    setLoading(true);
    try {
      await cloudService.gitPull();
      refreshGitStatus();
      actions.addNotification({ type: 'success', message: 'Pulled successfully' });
    } catch (e) {
      actions.addNotification({ type: 'error', message: `Pull failed: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const push = async () => {
    setLoading(true);
    try {
      await cloudService.gitPush();
      actions.addNotification({ type: 'success', message: 'Pushed successfully' });
    } catch (e) {
      actions.addNotification({ type: 'error', message: `Push failed: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  const switchBranch = async (branch) => {
    try {
      await cloudService.gitCheckout(branch);
      actions.setGitBranch(branch);
      setShowBranches(false);
      refreshGitStatus();
    } catch (e) {
      actions.addNotification({ type: 'error', message: `Branch switch failed: ${e.message}` });
    }
  };

  const staged = gitChanges.filter(c => c.staged);
  const unstaged = gitChanges.filter(c => !c.staged);

  return (
    <div className="git-panel sidebar-panel">
      <div className="panel-header">
        <h3>Source Control</h3>
        <div className="panel-header-actions">
          <button onClick={refreshGitStatus} title="Refresh" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Branch selector */}
      <div className="git-branch-bar">
        <button
          className="git-branch-selector"
          onClick={() => setShowBranches(!showBranches)}
        >
          <GitBranch size={14} />
          <span>{gitBranch}</span>
          <ChevronDown size={12} />
        </button>
        <div className="git-actions">
          <button onClick={pull} title="Pull" disabled={loading}>
            <Download size={14} />
          </button>
          <button onClick={push} title="Push" disabled={loading}>
            <Upload size={14} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showBranches && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="git-branch-list"
          >
            {gitBranches.map((branch) => (
              <button
                key={branch}
                className={`git-branch-item ${branch === gitBranch ? 'active' : ''}`}
                onClick={() => switchBranch(branch)}
              >
                <GitBranch size={12} />
                <span>{branch}</span>
                {branch === gitBranch && <Check size={12} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Commit input */}
      <div className="git-commit-section">
        <textarea
          className="git-commit-input"
          placeholder="Commit message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          rows={3}
        />
        <button
          className="git-commit-btn"
          onClick={commit}
          disabled={!commitMessage.trim() || staged.length === 0 || loading}
        >
          <Check size={14} />
          Commit ({staged.length} staged)
        </button>
      </div>

      {/* Staged changes */}
      <div className="git-changes-section">
        <button
          className="git-section-header"
          onClick={() => setExpandStaged(!expandStaged)}
        >
          {expandStaged ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Staged Changes</span>
          <span className="git-count">{staged.length}</span>
        </button>

        <AnimatePresence>
          {expandStaged && staged.map((change) => {
            const st = statusIcons[change.status] || statusIcons.modified;
            return (
              <motion.div
                key={`staged-${change.file}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="git-change-item"
              >
                <File size={14} />
                <span className="git-change-name">{change.file}</span>
                <span className="git-status-badge" style={{ color: st.color }}>{st.icon}</span>
                <button onClick={() => unstageFile(change.file)} title="Unstage">
                  <Minus size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Unstaged changes */}
      <div className="git-changes-section">
        <button
          className="git-section-header"
          onClick={() => setExpandUnstaged(!expandUnstaged)}
        >
          {expandUnstaged ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span>Changes</span>
          <span className="git-count">{unstaged.length}</span>
        </button>

        <AnimatePresence>
          {expandUnstaged && unstaged.map((change) => {
            const st = statusIcons[change.status] || statusIcons.modified;
            return (
              <motion.div
                key={`unstaged-${change.file}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="git-change-item"
              >
                <File size={14} />
                <span className="git-change-name">{change.file}</span>
                <span className="git-status-badge" style={{ color: st.color }}>{st.icon}</span>
                <div className="git-change-actions">
                  <button onClick={() => stageFile(change.file)} title="Stage">
                    <Plus size={14} />
                  </button>
                  <button title="Discard Changes">
                    <RotateCcw size={14} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GitPanel;
