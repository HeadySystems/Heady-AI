// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ FileExplorer v2.0.0                                   ║
// ║  Hierarchical file tree with folder expand/collapse            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, FolderOpen, File, FileText, Code, Image, Music,
  Video, Archive, ChevronRight, ChevronDown, FolderPlus,
  FilePlus, RefreshCw, Database, Settings, Package
} from 'lucide-react';

const FILE_ICON_MAP = {
  js: { icon: Code, color: '#f0db4f' },
  jsx: { icon: Code, color: '#61dafb' },
  ts: { icon: Code, color: '#3178c6' },
  tsx: { icon: Code, color: '#3178c6' },
  py: { icon: Code, color: '#3776ab' },
  java: { icon: Code, color: '#ed8b00' },
  go: { icon: Code, color: '#00add8' },
  rs: { icon: Code, color: '#dea584' },
  rb: { icon: Code, color: '#cc342d' },
  php: { icon: Code, color: '#777bb4' },
  css: { icon: Code, color: '#264de4' },
  scss: { icon: Code, color: '#cd6799' },
  html: { icon: Code, color: '#e34f26' },
  md: { icon: FileText, color: '#083fa1' },
  txt: { icon: FileText, color: '#94a3b8' },
  json: { icon: Settings, color: '#f0db4f' },
  yaml: { icon: Settings, color: '#cb171e' },
  yml: { icon: Settings, color: '#cb171e' },
  toml: { icon: Settings, color: '#9c4121' },
  sql: { icon: Database, color: '#336791' },
  jpg: { icon: Image, color: '#22d3ee' },
  jpeg: { icon: Image, color: '#22d3ee' },
  png: { icon: Image, color: '#22d3ee' },
  gif: { icon: Image, color: '#22d3ee' },
  svg: { icon: Image, color: '#ffb13b' },
  webp: { icon: Image, color: '#22d3ee' },
  mp3: { icon: Music, color: '#a855f7' },
  wav: { icon: Music, color: '#a855f7' },
  mp4: { icon: Video, color: '#ef4444' },
  zip: { icon: Archive, color: '#64748b' },
  tar: { icon: Archive, color: '#64748b' },
  gz: { icon: Archive, color: '#64748b' },
  env: { icon: Settings, color: '#eab308' },
  example: { icon: Settings, color: '#eab308' },
};

const getFileIcon = (fileName, isDirectory, isExpanded) => {
  if (isDirectory) {
    const IconComponent = isExpanded ? FolderOpen : Folder;
    return <IconComponent size={16} className="file-icon-svg" style={{ color: '#7dd3fc' }} />;
  }

  const ext = fileName?.split('.').pop()?.toLowerCase();
  const match = FILE_ICON_MAP[ext];
  if (match) {
    const IconComponent = match.icon;
    return <IconComponent size={16} className="file-icon-svg" style={{ color: match.color }} />;
  }

  if (fileName === 'package.json') return <Package size={16} style={{ color: '#e34f26' }} />;

  return <File size={16} className="file-icon-svg" style={{ color: '#64748b' }} />;
};

const TreeNode = ({ node, depth = 0, onFileSelect, activeFile, expandedFolders, toggleFolder }) => {
  const isExpanded = expandedFolders.has(node.path);
  const isActive = activeFile?.path === node.path;

  const handleClick = () => {
    if (node.isDirectory) {
      toggleFolder(node.path);
    } else {
      onFileSelect(node);
    }
  };

  return (
    <>
      <motion.div
        className={`file-item ${isActive ? 'active' : ''} ${node.isDirectory ? 'is-folder' : ''}`}
        onClick={handleClick}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        whileHover={{ backgroundColor: 'rgba(99, 102, 241, 0.08)' }}
        transition={{ duration: 0.1 }}
      >
        {node.isDirectory && (
          <span className="folder-arrow">
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {!node.isDirectory && <span className="folder-arrow-placeholder" />}
        <span className="file-icon">
          {getFileIcon(node.name, node.isDirectory, isExpanded)}
        </span>
        <span className="file-name">{node.name}</span>
        {isActive && <span className="active-dot">●</span>}
      </motion.div>

      <AnimatePresence>
        {node.isDirectory && isExpanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                activeFile={activeFile}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const FileExplorer = ({ fileTree, onFileSelect, activeFile, onOpenFolder, onRefresh, onCreateFile, onCreateFolder }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set([
    fileTree?.path,
    ...(fileTree?.children?.filter(c => c.isDirectory).map(c => c.path) || []),
  ]));

  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  return (
    <div className="panel-content file-explorer-panel">
      <div className="panel-header">
        <h3 className="panel-title">EXPLORER</h3>
        <div className="panel-actions">
          <button className="panel-action-btn" title="New File" onClick={onCreateFile}>
            <FilePlus size={14} />
          </button>
          <button className="panel-action-btn" title="New Folder" onClick={onCreateFolder}>
            <FolderPlus size={14} />
          </button>
          <button className="panel-action-btn" title="Refresh" onClick={onRefresh}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {fileTree ? (
        <div className="file-tree">
          <div className="file-tree-header" onClick={onOpenFolder}>
            <FolderOpen size={14} />
            <span className="tree-root-name">{fileTree.name}</span>
          </div>
          {fileTree.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={0}
              onFileSelect={onFileSelect}
              activeFile={activeFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Folder size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No folder opened</p>
          <motion.button
            className="open-folder-btn"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onOpenFolder}
          >
            Open Folder
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
