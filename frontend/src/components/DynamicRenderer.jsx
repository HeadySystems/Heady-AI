/**
 * DynamicRenderer — Renders UIProjection as grid layout (UI-1)
 * Takes a projection object from /api/projection/:userId and renders it as a responsive grid
 */
import { useState, useEffect, useCallback } from "react";
import useRealtime from "../hooks/useRealtime";

// Component registry — maps panel types to renderers (UI-7)
const PANEL_RENDERERS = {
  "chat": ChatPanel,
  "code-editor": CodeEditorPanel,
  "agent-monitor": AgentMonitorPanel,
  "service-grid": ServiceGridPanel,
  "terminal": TerminalPanel,
  "memory": MemoryPanel,
  "pipeline": PipelinePanel,
  "metrics": MetricsPanel,
};

export default function DynamicRenderer({ userId = "default", contextId = "default" }) {
  const [projection, setProjection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { lastMessage } = useRealtime(["projection"]);

  const fetchProjection = useCallback(async () => {
    try {
      const res = await fetch(`/api/projection/${userId}?contextId=${contextId}`);
      const data = await res.json();
      if (data.ok) setProjection(data.projection);
      else setError(data.error);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [userId, contextId]);

  useEffect(() => { fetchProjection(); }, [fetchProjection]);

  // React to projection updates via WebSocket
  useEffect(() => {
    if (lastMessage?.type === "projection:updated") fetchProjection();
  }, [lastMessage, fetchProjection]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={fetchProjection} />;
  if (!projection) return null;

  const { layout, columns = 3, panels = [], theme = {} } = projection;

  // Apply CSS vars from projection theme
  const containerStyle = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: "8px",
    padding: "8px",
    minHeight: "calc(100vh - 44px)",
    background: theme.cssVars?.["--bg-primary"] || "#0a0a1a",
    color: theme.cssVars?.["--text-primary"] || "#e0e0ff",
    fontFamily: "'Inter', sans-serif",
    ...(theme.cssVars ? Object.fromEntries(
      Object.entries(theme.cssVars).map(([k, v]) => [k, v])
    ) : {}),
  };

  return (
    <div className="dynamic-renderer" style={containerStyle}>
      {panels.map((panel) => {
        const Renderer = PANEL_RENDERERS[panel.type] || FallbackPanel;
        const { row = 0, col = 0, rowSpan = 1, colSpan = 1 } = panel.position || {};
        return (
          <div
            key={panel.id}
            className="panel"
            style={{
              gridRow: `${row + 1} / span ${rowSpan}`,
              gridColumn: `${col + 1} / span ${colSpan}`,
              background: "rgba(17, 17, 51, 0.8)",
              borderRadius: "12px",
              border: "1px solid rgba(108, 99, 255, 0.15)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              backdropFilter: "blur(12px)",
              transition: "all 0.3s ease",
            }}
          >
            <div style={{
              padding: "8px 14px",
              borderBottom: "1px solid rgba(108, 99, 255, 0.1)",
              fontSize: "12px",
              fontWeight: 600,
              color: "rgba(224, 224, 255, 0.7)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span>{panel.title || panel.type}</span>
              <span style={{ fontSize: "10px", opacity: 0.4 }}>{panel.type}</span>
            </div>
            <div style={{ flex: 1, padding: "12px", overflow: "auto" }}>
              <Renderer panel={panel} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Panel components
function ChatPanel({ panel }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ flex: 1, overflowY: "auto", fontSize: 13 }}>
        <div style={{ padding: 8, background: "rgba(108,99,255,0.1)", borderRadius: 8, marginBottom: 8 }}>
          💬 HeadyBuddy is ready. How can I help?
        </div>
      </div>
      <input
        placeholder="Type a message..."
        style={{
          padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(108,99,255,0.2)",
          background: "rgba(0,0,0,0.3)", color: "#e0e0ff", fontSize: 13, outline: "none",
        }}
      />
    </div>
  );
}

function CodeEditorPanel({ panel }) {
  return (
    <pre style={{ margin: 0, fontSize: 12, color: "#a0a0ff", lineHeight: 1.6 }}>
      {`// ${panel.config?.language || "javascript"}\n// Ready for editing...\nconst heady = require('heady-systems');\n\nawait heady.pipeline.run({\n  context: '${panel.id}',\n  mode: 'sacred-geometry'\n});\n`}
    </pre>
  );
}

function AgentMonitorPanel() {
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span>🤖 Active Agents</span><span style={{ color: "#4caf50" }}>3 running</span>
      </div>
      {["HeadyBuddy", "CodeAnalyzer", "PatternEngine"].map((a) => (
        <div key={a} style={{ padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between" }}>
          <span>{a}</span><span style={{ color: "#4caf50", fontSize: 11 }}>●</span>
        </div>
      ))}
    </div>
  );
}

function ServiceGridPanel() {
  const services = ["MCP Gateway", "Vector Memory", "CSL Engine", "Pipeline"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {services.map((s) => (
        <div key={s} style={{
          padding: "8px", borderRadius: 8, background: "rgba(108,99,255,0.08)",
          border: "1px solid rgba(108,99,255,0.1)", fontSize: 11, textAlign: "center",
        }}>{s}</div>
      ))}
    </div>
  );
}

function TerminalPanel() {
  return <pre style={{ margin: 0, fontSize: 11, color: "#888", lineHeight: 1.5 }}>$ heady-manager running on :3300{"\n"}$ WebSocket: ws://localhost:3300/ws{"\n"}$ _</pre>;
}

function MemoryPanel() {
  return <div style={{ fontSize: 12, textAlign: "center", padding: 20, opacity: 0.6 }}>🧠 Vector Memory Visualization</div>;
}

function PipelinePanel() {
  return <div style={{ fontSize: 12 }}><div style={{ color: "#4caf50" }}>✅ HCFullPipeline — 12/12 stages complete</div></div>;
}

function MetricsPanel() {
  return (
    <div style={{ fontSize: 12 }}>
      <div>CPU: <span style={{ color: "#6C63FF" }}>24%</span></div>
      <div>RAM: <span style={{ color: "#6C63FF" }}>512MB</span></div>
      <div>Uptime: <span style={{ color: "#4caf50" }}>99.97%</span></div>
    </div>
  );
}

function FallbackPanel({ panel }) {
  return <div style={{ fontSize: 12, opacity: 0.5 }}>Unknown panel type: {panel.type}</div>;
}

function LoadingState() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0a0a1a", color: "#6C63FF",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, animation: "spin 2s linear infinite" }}>∞</div>
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.6 }}>Loading workspace...</div>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0a0a1a", color: "#ff4444",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16 }}>Failed to load projection</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>{error}</div>
        <button onClick={onRetry} style={{
          marginTop: 16, padding: "8px 20px", borderRadius: 8,
          border: "1px solid #6C63FF", background: "transparent",
          color: "#6C63FF", cursor: "pointer",
        }}>Retry</button>
      </div>
    </div>
  );
}
