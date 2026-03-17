/**
 * TaskAutomation.jsx — HeadyBuddy Task Automation Panel
 * Allows Buddy to perform digital tasks on behalf of the user
 */
import React, { useState, useCallback } from "react";
import { Play, Clock, CheckCircle, AlertCircle, Globe, FolderOpen, Bell, Clipboard } from "lucide-react";

const TASK_TYPES = [
  { id: "open-url", label: "Open Website", icon: Globe, color: "#22d3ee" },
  { id: "file-search", label: "Find Files", icon: FolderOpen, color: "#a78bfa" },
  { id: "clipboard", label: "Clipboard", icon: Clipboard, color: "#34d399" },
  { id: "notify", label: "Reminder", icon: Bell, color: "#fbbf24" },
];

export default function TaskAutomation({ onTaskComplete }) {
  const [activeTask, setActiveTask] = useState(null);
  const [taskInput, setTaskInput] = useState("");
  const [taskHistory, setTaskHistory] = useState([]);
  const [status, setStatus] = useState("idle");

  const isDesktop = typeof window !== "undefined" && window.headyDesktop;

  const executeTask = useCallback(async (type, params) => {
    setStatus("running");
    try {
      let result;
      if (isDesktop) {
        result = await window.headyDesktop.executeTask({ type, ...params });
      } else {
        // Web fallback - send to cloud API
        const res = await fetch(`${import.meta.env.VITE_HEADY_API || "https://manager.headysystems.com"}/api/buddy/task`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, ...params }),
        });
        result = await res.json();
      }

      const entry = { type, params, result, ts: Date.now(), success: result.success };
      setTaskHistory(prev => [entry, ...prev].slice(0, 50));
      setStatus(result.success ? "success" : "error");
      if (onTaskComplete) onTaskComplete(entry);
      setTimeout(() => setStatus("idle"), 2000);
      return result;
    } catch (err) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return { success: false, error: err.message };
    }
  }, [isDesktop, onTaskComplete]);

  const handleQuickAction = useCallback((type) => {
    setActiveTask(type);
    setTaskInput("");
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!activeTask || !taskInput.trim()) return;

    const params = {};
    switch (activeTask) {
      case "open-url": params.url = taskInput; break;
      case "clipboard": params.action = "write"; params.data = taskInput; break;
      case "notify": params.title = "HeadyBuddy Reminder"; params.body = taskInput; break;
      case "file-search": params.filters = [{ name: "All", extensions: ["*"] }]; break;
    }

    await executeTask(activeTask, params);
    setActiveTask(null);
    setTaskInput("");
  }, [activeTask, taskInput, executeTask]);

  const statusIcon = status === "running" ? Clock : status === "success" ? CheckCircle : status === "error" ? AlertCircle : Play;

  return (
    <div style={{
      padding: "12px",
      background: "rgba(15, 15, 25, 0.6)",
      borderRadius: "13px",
      border: "1px solid rgba(34, 211, 238, 0.15)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        {React.createElement(statusIcon, { size: 16, color: status === "error" ? "#f87171" : status === "success" ? "#34d399" : "#22d3ee" })}
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>Task Automation</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: activeTask ? "10px" : 0 }}>
        {TASK_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => handleQuickAction(t.id)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 10px", borderRadius: "8px",
              background: activeTask === t.id ? `${t.color}22` : "rgba(30, 30, 50, 0.5)",
              border: `1px solid ${activeTask === t.id ? t.color : "rgba(100,100,150,0.2)"}`,
              color: t.color, fontSize: "11px", fontWeight: 500, cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {React.createElement(t.icon, { size: 14 })}
            {t.label}
          </button>
        ))}
      </div>

      {activeTask && (
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            placeholder={activeTask === "open-url" ? "Enter URL..." : activeTask === "notify" ? "Reminder text..." : "Enter value..."}
            autoFocus
            style={{
              flex: 1, padding: "8px 12px", borderRadius: "8px",
              background: "rgba(20, 20, 35, 0.8)", border: "1px solid rgba(100,100,150,0.3)",
              color: "#e2e8f0", fontSize: "12px", outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 14px", borderRadius: "8px",
              background: "linear-gradient(135deg, #22d3ee, #6366f1)",
              border: "none", color: "#fff", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}
          >
            Go
          </button>
        </form>
      )}

      {taskHistory.length > 0 && (
        <div style={{ marginTop: "8px", maxHeight: "80px", overflowY: "auto" }}>
          {taskHistory.slice(0, 3).map((h, i) => (
            <div key={i} style={{
              fontSize: "10px", color: h.success ? "#6ee7b7" : "#fca5a5",
              padding: "2px 0", opacity: 0.7,
            }}>
              {h.success ? "✓" : "✗"} {h.type} — {new Date(h.ts).toLocaleTimeString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
