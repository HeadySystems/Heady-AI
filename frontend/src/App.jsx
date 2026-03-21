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
// ║  FILE: frontend/src/App.jsx                                                    ║
// ║  LAYER: ui/frontend                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
import { useState, useEffect } from "react";
import { Activity, Cpu, Zap, Globe, Server } from "lucide-react";
import ContextSwitcher from "./components/ContextSwitcher";
import DynamicRenderer from "./components/DynamicRenderer";
import PanelManager from "./components/PanelManager";

export default function App() {
  const [tab, setTab] = useState('Dashboard');
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'workspace'
  const [health, setHealth] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [projection, setProjection] = useState(null);

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
    fetch("/api/system/status").then(r => r.json()).then(setSystemStatus).catch(() => {});
  }, []);

  if (view === 'workspace') {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a1a" }}>
        <ContextSwitcher userId="default" />
        <DynamicRenderer userId="default" />
        <PanelManager projection={projection} onUpdate={setProjection} userId="default" />
        <button
          onClick={() => setView('dashboard')}
          style={{
            position: "fixed", top: 8, right: 16, zIndex: 1001,
            padding: "4px 12px", borderRadius: 6, fontSize: 11,
            background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)",
            color: "#e0e0ff", cursor: "pointer",
          }}
        >
          Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <ContextSwitcher userId="default" />
      <div className="p-8">
      <header className="max-w-6xl mx-auto mb-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-breathe" />
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Heady Systems
          </h1>
        </div>
        <p className="text-gray-500 text-sm">
          Sacred Geometry :: Organic Systems :: Breathing Interfaces
        </p>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Health Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-green-800 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold">Health</h2>
          </div>
          {health ? (
            <div className="space-y-2 text-sm text-gray-400">
              <p>Status: <span className="text-green-400">OK</span></p>
              <p>Version: {health.version}</p>
              <p>Uptime: {Math.floor(health.uptime)}s</p>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Loading...</p>
          )}
        </div>

        {/* System Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-cyan-800 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">System</h2>
          </div>
          {systemStatus ? (
            <div className="space-y-2 text-sm text-gray-400">
              <p>Environment: <span className="text-cyan-400">{systemStatus.environment}</span></p>
              <p>Nodes: {systemStatus.capabilities?.nodes?.active || 0}/{systemStatus.capabilities?.nodes?.total || 0}</p>
              <p>Production Ready: {systemStatus.production_ready ? "Yes" : "No"}</p>
            </div>
          ) : (
            <p className="text-gray-600 text-sm">Loading...</p>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-purple-800 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Actions</h2>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => fetch("/api/system/production", { method: "POST" }).then(r => r.json()).then(d => { alert("Production activated!"); location.reload(); })}
              className="w-full px-4 py-2 bg-purple-900/50 border border-purple-700/50 rounded-xl text-sm text-purple-300 hover:bg-purple-800/50 transition-colors"
            >
              Activate Production
            </button>
            <button
              onClick={() => fetch("/api/pipeline/run", { method: "POST" }).then(r => r.json()).then(d => alert(JSON.stringify(d, null, 2)))}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
            >
              Run Pipeline
            </button>
          </div>
        </div>
      </main>
      <div style={{ textAlign: "center", marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
        <button
          onClick={() => setView('workspace')}
          className="px-6 py-2 bg-purple-900/50 border border-purple-700/50 rounded-xl text-sm text-purple-300 hover:bg-purple-800/50 transition-colors"
        >
          Open Workspace View →
        </button>
        <a
          href="https://web.headysystems.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-2 bg-cyan-900/50 border border-cyan-700/50 rounded-xl text-sm text-cyan-300 hover:bg-cyan-800/50 transition-colors inline-block"
        >
          Open HeadyAI-IDE →
        </a>
      </div>
      </div>
    </div>
  );
}
