/**
 * PanelManager — Drag-and-drop panel management (UI-3)
 * Allows users to add, remove, resize, and rearrange panels in the dynamic UI
 */
import { useState, useCallback } from "react";

const AVAILABLE_PANELS = [
  { type: "chat", label: "HeadyBuddy Chat", icon: "💬" },
  { type: "code-editor", label: "Code Editor", icon: "📝" },
  { type: "agent-monitor", label: "Agent Monitor", icon: "🤖" },
  { type: "service-grid", label: "Service Grid", icon: "⚙️" },
  { type: "terminal", label: "Terminal", icon: "💻" },
  { type: "memory", label: "Memory Viewer", icon: "🧠" },
  { type: "pipeline", label: "Pipeline", icon: "🔄" },
  { type: "metrics", label: "Metrics", icon: "📊" },
];

export default function PanelManager({ projection, onUpdate, userId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dragSource, setDragSource] = useState(null);

  const currentPanels = projection?.panels || [];

  const addPanel = useCallback((panelType) => {
    const panel = AVAILABLE_PANELS.find((p) => p.type === panelType);
    if (!panel) return;

    const newPanel = {
      id: `${panelType}-${Date.now()}`,
      type: panelType,
      title: panel.label,
      position: {
        row: Math.floor(currentPanels.length / (projection?.columns || 3)),
        col: currentPanels.length % (projection?.columns || 3),
        rowSpan: 1,
        colSpan: 1,
      },
      config: {},
    };

    const updated = { ...projection, panels: [...currentPanels, newPanel] };
    onUpdate(updated);

    // Save to backend
    fetch(`/api/projection/${userId}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projection: updated }),
    }).catch(() => {});
  }, [currentPanels, projection, onUpdate, userId]);

  const removePanel = useCallback((panelId) => {
    const updated = {
      ...projection,
      panels: currentPanels.filter((p) => p.id !== panelId),
    };
    onUpdate(updated);

    fetch(`/api/projection/${userId}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projection: updated }),
    }).catch(() => {});
  }, [currentPanels, projection, onUpdate, userId]);

  const handleDragStart = (idx) => setDragSource(idx);
  const handleDrop = (targetIdx) => {
    if (dragSource === null || dragSource === targetIdx) return;
    const panels = [...currentPanels];
    const [moved] = panels.splice(dragSource, 1);
    panels.splice(targetIdx, 0, moved);

    // Recalculate grid positions
    const cols = projection?.columns || 3;
    panels.forEach((p, i) => {
      p.position = { ...p.position, row: Math.floor(i / cols), col: i % cols };
    });

    const updated = { ...projection, panels };
    onUpdate(updated);
    setDragSource(null);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 1000,
          width: 48, height: 48, borderRadius: "50%",
          background: "linear-gradient(135deg, #6C63FF, #4834d4)",
          border: "none", color: "#fff", fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(108, 99, 255, 0.4)",
          transition: "transform 0.2s ease",
          transform: isOpen ? "rotate(45deg)" : "none",
        }}
      >
        +
      </button>

      {/* Panel drawer */}
      {isOpen && (
        <div style={{
          position: "fixed", bottom: 80, right: 20, zIndex: 999,
          width: 280, maxHeight: 400,
          background: "rgba(17, 17, 51, 0.95)",
          borderRadius: 16,
          border: "1px solid rgba(108, 99, 255, 0.2)",
          backdropFilter: "blur(16px)",
          padding: 16,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
          fontFamily: "'Inter', sans-serif",
          overflowY: "auto",
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#e0e0ff" }}>
            Panel Manager
          </div>

          {/* Available panels to add */}
          <div style={{ fontSize: 11, color: "rgba(224,224,255,0.5)", marginBottom: 8 }}>
            Add Panel
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
            {AVAILABLE_PANELS.map((p) => (
              <button
                key={p.type}
                onClick={() => addPanel(p.type)}
                style={{
                  padding: "8px 6px", borderRadius: 8,
                  border: "1px solid rgba(108,99,255,0.15)",
                  background: "rgba(108,99,255,0.05)",
                  color: "#e0e0ff", cursor: "pointer",
                  fontSize: 11, textAlign: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ fontSize: 16 }}>{p.icon}</div>
                <div style={{ marginTop: 2 }}>{p.label}</div>
              </button>
            ))}
          </div>

          {/* Current panels — drag to reorder, click × to remove */}
          <div style={{ fontSize: 11, color: "rgba(224,224,255,0.5)", marginBottom: 8 }}>
            Current Panels ({currentPanels.length})
          </div>
          {currentPanels.map((panel, idx) => (
            <div
              key={panel.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 10px", marginBottom: 4, borderRadius: 6,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(108,99,255,0.08)",
                cursor: "grab", fontSize: 12,
              }}
            >
              <span style={{ color: "#e0e0ff" }}>
                {AVAILABLE_PANELS.find((p) => p.type === panel.type)?.icon || "❓"} {panel.title}
              </span>
              <button
                onClick={() => removePanel(panel.id)}
                style={{
                  background: "none", border: "none", color: "rgba(255,100,100,0.6)",
                  cursor: "pointer", fontSize: 14, padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
