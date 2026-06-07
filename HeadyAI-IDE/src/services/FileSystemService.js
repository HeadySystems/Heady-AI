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
// ║  FILE: HeadyAI-IDE/src/services/FileSystemService.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ FileSystemService v1.0.0                               ║
// ║  Browser File System Access API + in-memory fallback           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

const PHI = 1.618033988749895;

// Demo file tree for instant functionality
const DEMO_FILES = {
  name: 'heady-project',
  path: '/heady-project',
  isDirectory: true,
  children: [
    {
      name: 'src',
      path: '/heady-project/src',
      isDirectory: true,
      children: [
        {
          name: 'index.js',
          path: '/heady-project/src/index.js',
          isDirectory: false,
          content: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Application Entry v1.0.0                               ║
// ║  Main entry point for the Heady application                    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { createApp } from './app.js';
import { initSacredGeometry } from './sacred-geometry.js';

const PHI = 1.618033988749895;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

async function main() {
  // Initialize sacred geometry canvas
  const canvas = initSacredGeometry({
    scale: PHI,
    breatheInterval: FIB[7] * 100, // 2100ms
    pattern: 'flower-of-life',
  });

  // Bootstrap application
  const app = await createApp({
    theme: 'cosmic-dark',
    phi: PHI,
  });

  app.mount('#root');
  console.info('[Heady] Application initialized with φ-scaled parameters');
}

main();
`,
        },
        {
          name: 'app.js',
          path: '/heady-project/src/app.js',
          isDirectory: false,
          content: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ App Module v1.0.0                                     ║
// ║  Core application factory with CSL gate integration            ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

const PHI = 1.618033988749895;

export function createApp(config = {}) {
  const state = {
    theme: config.theme || 'cosmic-dark',
    phi: config.phi || PHI,
    ready: false,
    modules: new Map(),
  };

  return {
    mount(selector) {
      const el = document.querySelector(selector);
      if (!el) throw new Error(\`Mount target "\${selector}" not found\`);
      state.ready = true;
      return state;
    },

    getState() {
      return { ...state };
    },

    registerModule(name, module) {
      state.modules.set(name, module);
    },
  };
}
`,
        },
        {
          name: 'sacred-geometry.js',
          path: '/heady-project/src/sacred-geometry.js',
          isDirectory: false,
          content: `// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Sacred Geometry Engine v1.0.0                          ║
// ║  Flower of Life, Metatron's Cube, and phi-scaled animations    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

const PHI = 1.618033988749895;
const TAU = Math.PI * 2;

export function initSacredGeometry(config = {}) {
  const { scale = PHI, breatheInterval = 2100, pattern = 'flower-of-life' } = config;

  function drawFlowerOfLife(ctx, cx, cy, radius) {
    const petals = 6;
    for (let i = 0; i < petals; i++) {
      const angle = (TAU / petals) * i;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.stroke();
    }
    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();
  }

  function drawMetatronsCube(ctx, cx, cy, radius) {
    const points = [];
    for (let i = 0; i < 13; i++) {
      const angle = (TAU / 12) * i;
      const r = i === 0 ? 0 : (i <= 6 ? radius : radius * PHI);
      points.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    }
    // Connect all points
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }
  }

  return { drawFlowerOfLife, drawMetatronsCube, scale, breatheInterval };
}
`,
        },
      ],
    },
    {
      name: 'package.json',
      path: '/heady-project/package.json',
      isDirectory: false,
      content: JSON.stringify(
        {
          name: 'heady-project',
          version: '1.0.0',
          type: 'module',
          description: 'A Heady™ project with Sacred Geometry design principles',
          main: 'src/index.js',
          scripts: {
            dev: 'node src/index.js',
            test: 'vitest run',
            build: 'vite build',
          },
          dependencies: {},
        },
        null,
        2,
      ),
    },
    {
      name: 'README.md',
      path: '/heady-project/README.md',
      isDirectory: false,
      content: `# Heady™ Project

> ∞ Sacred Geometry · Liquid Intelligence · Permanent Life ∞

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Architecture

- **Sacred Geometry Engine** — φ-scaled canvas animations
- **CSL Gate Logic** — Continuous Semantic Logic for intelligent routing
- **Liquid Architecture** — Self-organizing, adaptive system design

## Constants

| Symbol | Value | Usage |
|--------|-------|-------|
| φ (PHI) | 1.618033988749895 | All scaling ratios |
| FIB[] | [1,1,2,3,5,8,13,21...] | Pool sizes, retries |
| τ (TAU) | 6.283185307179586 | Angular calculations |

---

*© 2026 HeadySystems Inc. — Eric Haywood, Founder*
`,
    },
    {
      name: '.env.example',
      path: '/heady-project/.env.example',
      isDirectory: false,
      content: `# Heady™ Environment Configuration
HEADY_API_KEY=[SECRET]
DATABASE_URL=[SECRET]
UPSTASH_REDIS_REST_URL=[SECRET]
UPSTASH_REDIS_REST_TOKEN=[SECRET]
NODE_ENV=production
`,
    },
  ],
};

import cloudService from './CloudService';

class FileSystemService {
  constructor() {
    this.directoryHandle = null;
    this.directoryPath = null;
    this.fileHandles = new Map();
    this.fileTree = null;
    this.useNativeFS = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  // Check if running in Electron
  isElectron() {
    return (
      typeof window !== 'undefined' &&
      window.process &&
      window.process.versions &&
      window.process.versions.electron
    );
  }

  // Get ipcRenderer if in Electron
  getIpcRenderer() {
    if (this.isElectron()) {
      try {
        return window.require('electron').ipcRenderer;
      } catch (e) {
        console.error('[FileSystemService] Failed to load Electron ipcRenderer:', e);
      }
    }
    return null;
  }

  // Helper to extract workspace and key from path
  _parseCloudPath(path) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 1) {
      const wsName = parts[0];
      const key = parts.slice(1).join('/');
      return { wsName, key };
    }
    return { wsName: 'default', key: path };
  }

  // Convert flat files array from R2 to nested tree
  convertFlatListToTree(files, wsName = 'default') {
    const root = {
      name: wsName,
      path: `/${wsName}`,
      isDirectory: true,
      children: [],
    };

    for (const file of files) {
      const parts = file.key.split('/');
      let current = root;
      let currentPath = `/${wsName}`;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        currentPath = `${currentPath}/${part}`;
        const isLast = i === parts.length - 1;

        let existing = current.children.find((child) => child.name === part);
        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            isDirectory: !isLast,
            children: isLast ? undefined : [],
          };
          current.children.push(existing);
        }
        current = existing;
      }
    }

    const sortTree = (node) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
      }
    };
    sortTree(root);

    return root;
  }

  // Get demo file tree for immediate use
  getDemoFileTree() {
    return DEMO_FILES;
  }

  async _buildElectronTree(dirPath, parentPath = '') {
    const ipc = this.getIpcRenderer();
    if (!ipc) return null;

    // Get the last component of the path as the folder name
    const parts = dirPath.split(/[/\\]/).filter(Boolean);
    const folderName = parts[parts.length - 1] || dirPath;

    const node = {
      name: folderName,
      path: dirPath,
      isDirectory: true,
      children: [],
    };

    try {
      const files = await ipc.invoke('read-dir', dirPath);
      // Sort files: directories first, then alphabetical
      const sortedFiles = [...files].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      for (const file of sortedFiles) {
        if (
          file.name.startsWith('.') ||
          file.name === 'node_modules' ||
          file.name === 'build' ||
          file.name === 'dist'
        ) {
          continue;
        }
        if (file.isDirectory) {
          const childNode = await this._buildElectronTree(file.path, node.path);
          if (childNode) {
            node.children.push(childNode);
          }
        } else {
          node.children.push({
            name: file.name,
            path: file.path,
            isDirectory: false,
          });
        }
      }
      return node;
    } catch (err) {
      console.error('[FileSystemService] Error building Electron tree for ' + dirPath, err);
      return null;
    }
  }

  // Open folder using File System Access API or Cloud Service
  async openFolder(refresh = false) {
    if (cloudService.isConnected) {
      try {
        const result = await cloudService.listFiles('default');
        if (result && result.files) {
          this.fileTree = this.convertFlatListToTree(result.files, 'default');
          return this.fileTree;
        }
      } catch (err) {
        console.error('[FileSystemService] Failed to load cloud workspace tree:', err);
      }
    }

    if (this.isElectron()) {
      const ipc = this.getIpcRenderer();
      if (ipc) {
        try {
          let selectedPath = this.directoryPath;
          if (!selectedPath || !refresh) {
            selectedPath = await ipc.invoke('select-folder');
          }
          if (selectedPath) {
            this.directoryPath = selectedPath;
            this.fileTree = await this._buildElectronTree(selectedPath);
            return this.fileTree;
          }
          return this.fileTree || this.getDemoFileTree();
        } catch (err) {
          console.error('[FileSystemService] Failed to select folder in Electron:', err);
        }
      }
    }

    if (this.useNativeFS) {
      try {
        let handle = this.directoryHandle;
        if (!handle || !refresh) {
          handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        }
        this.directoryHandle = handle;
        this.fileTree = await this._buildTree(this.directoryHandle, '');
        return this.fileTree;
      } catch (err) {
        if (err.name === 'AbortError') return this.fileTree || this.getDemoFileTree();
        throw err;
      }
    }
    return this.getDemoFileTree();
  }

  async _buildTree(handle, parentPath, depth = 0) {
    if (depth > 5) return null; // Max depth safety
    const node = {
      name: handle.name,
      path: parentPath ? `${parentPath}/${handle.name}` : `/${handle.name}`,
      isDirectory: handle.kind === 'directory',
      children: [],
    };

    if (handle.kind === 'directory') {
      const entries = [];
      for await (const entry of handle.values()) {
        // Skip hidden files/dirs and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        entries.push(entry);
      }
      // Sort: directories first, then alphabetical
      entries.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        const child = await this._buildTree(entry, node.path, depth + 1);
        if (child) node.children.push(child);
      }
    }

    // Store handles for later read/write
    this.fileHandles.set(node.path, handle);
    return node;
  }

  // Read file content
  async readFile(path) {
    if (cloudService.isConnected) {
      const { wsName, key } = this._parseCloudPath(path);
      try {
        return await cloudService.readFile(key, wsName);
      } catch (err) {
        console.error('[FileSystemService] Failed to read cloud file:', err);
      }
    }

    if (this.isElectron()) {
      const ipc = this.getIpcRenderer();
      if (ipc) {
        try {
          return await ipc.invoke('read-file', path);
        } catch (err) {
          console.error('[FileSystemService] Failed to read file in Electron:', err);
          return '';
        }
      }
    }

    // Check native FS first
    const handle = this.fileHandles.get(path);
    if (handle && handle.kind === 'file') {
      const file = await handle.getFile();
      return await file.text();
    }

    // Fallback to demo tree
    return this._findInTree(DEMO_FILES, path)?.content || '';
  }

  // Write file content
  async writeFile(path, content) {
    if (cloudService.isConnected) {
      const { wsName, key } = this._parseCloudPath(path);
      try {
        await cloudService.writeFile(key, content, wsName);
        return true;
      } catch (err) {
        console.error('[FileSystemService] Failed to write cloud file:', err);
        return false;
      }
    }

    if (this.isElectron()) {
      const ipc = this.getIpcRenderer();
      if (ipc) {
        try {
          await ipc.invoke('write-file', path, content);
          return true;
        } catch (err) {
          console.error('[FileSystemService] Failed to write file in Electron:', err);
          return false;
        }
      }
    }

    const handle = this.fileHandles.get(path);
    if (handle && handle.kind === 'file') {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    }
    // For demo mode, update in-memory
    const node = this._findInTree(DEMO_FILES, path);
    if (node) {
      node.content = content;
      return true;
    }
    return false;
  }

  // Create file
  async createFile(path, content = '') {
    if (cloudService.isConnected) {
      const { wsName, key } = this._parseCloudPath(path);
      try {
        await cloudService.createFile(key, content, wsName);
        return true;
      } catch (err) {
        console.error('[FileSystemService] Failed to create cloud file:', err);
        return false;
      }
    }

    if (this.isElectron()) {
      const ipc = this.getIpcRenderer();
      if (ipc) {
        try {
          await ipc.invoke('write-file', path, content);
          return true;
        } catch (err) {
          console.error('[FileSystemService] Failed to create file in Electron:', err);
          return false;
        }
      }
    }

    if (this.directoryHandle) {
      try {
        const parts = path.split('/').filter(Boolean);
        let currentHandle = this.directoryHandle;
        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i], { create: true });
        }
        const fileHandle = await currentHandle.getFileHandle(parts[parts.length - 1], {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err) {
        console.error('[FileSystemService] Failed to create file locally:', err);
        return false;
      }
    }

    return false;
  }

  // Create directory
  async createDirectory(path) {
    if (this.isElectron()) {
      const ipc = this.getIpcRenderer();
      if (ipc) {
        try {
          await ipc.invoke('create-folder', path);
          return true;
        } catch (err) {
          console.error('[FileSystemService] Failed to create directory in Electron:', err);
          return false;
        }
      }
    }

    if (this.directoryHandle) {
      try {
        const parts = path.split('/').filter(Boolean);
        let currentHandle = this.directoryHandle;
        for (const part of parts) {
          currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
        }
        return true;
      } catch (err) {
        console.error('[FileSystemService] Failed to create directory locally:', err);
        return false;
      }
    }

    return false;
  }

  // Delete file
  async deleteFile(path) {
    if (cloudService.isConnected) {
      const { wsName, key } = this._parseCloudPath(path);
      try {
        await cloudService.deleteFile(key, wsName);
        return true;
      } catch (err) {
        console.error('[FileSystemService] Failed to delete cloud file:', err);
        return false;
      }
    }

    if (this.isElectron()) {
      const ipc = this.getIpcRenderer();
      if (ipc) {
        try {
          await ipc.invoke('delete-file', path);
          return true;
        } catch (err) {
          console.error('[FileSystemService] Failed to delete file in Electron:', err);
          return false;
        }
      }
    }

    if (this.directoryHandle) {
      try {
        const parts = path.split('/').filter(Boolean);
        let currentHandle = this.directoryHandle;
        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }
        await currentHandle.removeEntry(parts[parts.length - 1]);
        return true;
      } catch (err) {
        console.error('[FileSystemService] Failed to delete file locally:', err);
        return false;
      }
    }

    return false;
  }

  // Delete directory
  async deleteDirectory(path) {
    if (this.isElectron()) {
      const ipc = this.getIpcRenderer();
      if (ipc) {
        try {
          await ipc.invoke('delete-folder', path);
          return true;
        } catch (err) {
          console.error('[FileSystemService] Failed to delete directory in Electron:', err);
          return false;
        }
      }
    }

    if (this.directoryHandle) {
      try {
        const parts = path.split('/').filter(Boolean);
        let currentHandle = this.directoryHandle;
        for (let i = 0; i < parts.length - 1; i++) {
          currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
        }
        await currentHandle.removeEntry(parts[parts.length - 1], { recursive: true });
        return true;
      } catch (err) {
        console.error('[FileSystemService] Failed to delete directory locally:', err);
        return false;
      }
    }

    return false;
  }

  _findInTree(node, path) {
    if (node.path === path) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this._findInTree(child, path);
        if (found) return found;
      }
    }
    return null;
  }

  // Flatten tree for search
  flattenTree(node = null) {
    const root = node || this.fileTree || DEMO_FILES;
    const result = [];
    const walk = (n) => {
      result.push(n);
      if (n.children) n.children.forEach(walk);
    };
    walk(root);
    return result;
  }
}

const fileSystemService = new FileSystemService();
export default fileSystemService;
export { FileSystemService, DEMO_FILES };
