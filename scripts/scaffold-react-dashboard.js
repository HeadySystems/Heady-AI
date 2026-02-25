/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("⚛️ [Heady-React-Scaffold] Bootstrapping HeadyOS React Dashboard...");

const targetDir = path.join(__dirname, '..', 'sites', 'headyos-react');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Scaffold critical React components that consume our new backend APIs
const components = {
    'StatusWidget.jsx': `
import React, { useEffect, useState } from 'react';
export default function StatusWidget() {
  const [status, setStatus] = useState('Loading...');
  useEffect(() => {
    fetch('https://api.headysystems.com/v1/ops/status')
      .then(res => res.json())
      .then(data => setStatus(data.overall))
      .catch(() => setStatus('Offline'));
  }, []);
  return <div className="glass-panel p-4"><h3>Conductor Status</h3><p className="text-emerald">{status}</p></div>;
}`,

    'App.jsx': `
import React from 'react';
import StatusWidget from './StatusWidget';
import '../public/heady-design-system.css';

export default function HeadyOS() {
  return (
    <div className="min-h-screen bg-deep text-white p-8">
      <h1 className="text-3xl font-bold text-gradient mb-8">HeadyOS Command Center</h1>
      <div className="grid grid-cols-3 gap-6">
        <StatusWidget />
        <div className="glass-panel p-4"><h3>Active Assistants</h3><p>12/12 Online</p></div>
        <div className="glass-panel p-4"><h3>Edge Cache</h3><p>Predictive Warming Active</p></div>
      </div>
    </div>
  );
}`
};

for (const [name, content] of Object.entries(components)) {
    fs.writeFileSync(path.join(targetDir, name), content.trim());
    console.log(`✅ Scaffolded ${name}`);
}

console.log("🚀 Run `npx create-vite@latest . --template react` in sites/headyos-react to inject build tooling.");
