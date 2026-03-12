/**
 * ContextSwitcher — Persistent context bar with keyboard shortcuts (F-6, CS-1 to CS-7)
 * Persistent bar (not dropdown), Ctrl+1/2/3 shortcuts, drag-to-reorder, Framer-style transitions
 */
import { useState, useEffect, useCallback, useRef } from "react";
import useRealtime from "../hooks/useRealtime";

const CONTEXT_API = "/api/context";

export default function ContextSwitcher({ userId = "default" }) {
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const { connected, lastMessage, switchContext } = useRealtime(["context"]);
  const barRef = useRef(null);

  // Fetch contexts from API
  const fetchContexts = useCallback(async () => {
    try {
      const res = await fetch(`${CONTEXT_API}?userId=${userId}`);
      const data = await res.json();
      setContexts(data.contexts || []);
    } catch { /* network error */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchContexts(); }, [fetchContexts]);

  // React to WebSocket context updates
  useEffect(() => {
    if (lastMessage?.type?.startsWith("context:")) fetchContexts();
  }, [lastMessage, fetchContexts]);

  // Activate a context (CS-1, CS-7 transition)
  const activateContext = useCallback(async (contextId) => {
    setTransitioning(true);
    try {
      await fetch(`${CONTEXT_API}/${contextId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      switchContext(contextId, userId);
      await fetchContexts();
    } catch { /* error */ }
    setTimeout(() => setTransitioning(false), 300); // 300ms morph (CS-7)
  }, [userId, switchContext, fetchContexts]);

  // Keyboard shortcuts — Ctrl+1/2/3/etc. (CS-5)
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        if (contexts[idx]) {
          e.preventDefault();
          activateContext(contexts[idx].id);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [contexts, activateContext]);

  // Drag-to-reorder (CS-6)
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetIdx) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const updated = [...contexts];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setContexts(updated);
    setDragIdx(null);
  };

  // Create default contexts if none exist
  useEffect(() => {
    if (!loading && contexts.length === 0) {
      const defaults = [
        { name: "HeadyAI-IDE", type: "development", config: { theme: "dark", layout: "ide" } },
        { name: "Creative Studio", type: "creative", config: { theme: "sacred-geometry", layout: "canvas" } },
        { name: "Command Center", type: "operations", config: { theme: "dark", layout: "dashboard" } },
      ];
      Promise.all(defaults.map((ctx) =>
        fetch(CONTEXT_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, ...ctx }),
        })
      )).then(fetchContexts);
    }
  }, [loading, contexts.length, userId, fetchContexts]);

  const activeCtx = contexts.find((c) => c.active);

  return (
    <div
      ref={barRef}
      className={`context-switcher ${transitioning ? "transitioning" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 12px",
        background: "linear-gradient(135deg, #0d0d2b 0%, #1a1a4e 100%)",
        borderBottom: "1px solid rgba(108, 99, 255, 0.2)",
        fontFamily: "'Inter', sans-serif",
        fontSize: "13px",
        userSelect: "none",
        transition: "all 0.3s ease",
        minHeight: "36px",
      }}
    >
      {/* Connection indicator */}
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: connected ? "#4caf50" : "#f44336",
        boxShadow: connected ? "0 0 6px #4caf50" : "0 0 6px #f44336",
        marginRight: 8, flexShrink: 0,
      }} />

      {/* Context tabs */}
      {contexts.map((ctx, idx) => (
        <button
          key={ctx.id}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(idx)}
          onClick={() => activateContext(ctx.id)}
          title={`${ctx.name} (Ctrl+${idx + 1})`}
          style={{
            padding: "4px 14px",
            borderRadius: "6px",
            border: ctx.active ? "1px solid #6C63FF" : "1px solid transparent",
            background: ctx.active
              ? "linear-gradient(135deg, rgba(108,99,255,0.25) 0%, rgba(108,99,255,0.1) 100%)"
              : "transparent",
            color: ctx.active ? "#fff" : "rgba(224, 224, 255, 0.6)",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: ctx.active ? 600 : 400,
            transition: "all 0.2s ease",
            whiteSpace: "nowrap",
            letterSpacing: "0.3px",
            boxShadow: ctx.active ? "0 0 12px rgba(108, 99, 255, 0.2)" : "none",
          }}
        >
          <span style={{ marginRight: 4, opacity: 0.5, fontSize: "10px" }}>{idx + 1}</span>
          {ctx.name}
        </button>
      ))}

      {/* Active context info */}
      {activeCtx && (
        <span style={{
          marginLeft: "auto", color: "rgba(224,224,255,0.4)", fontSize: "11px",
        }}>
          {activeCtx.type} · {new Date(activeCtx.updatedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
