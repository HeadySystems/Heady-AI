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
// ║  FILE: headybuddy/src/App.jsx                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║  HEADY SYSTEMS                                                 ║
 * ║  ━━━━━━━━━━━━━━                                                ║
 * ║  ∞ Sacred Geometry Architecture ∞                              ║
 * ║                                                                ║
 * ║  App.jsx - HeadyBuddy Root Component                           ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import CollapsedPill from "./components/CollapsedPill";
import MainWidget from "./components/MainWidget";
import ExpandedView from "./components/ExpandedView";
import CrossDeviceSync from "./components/CrossDeviceSync";
import DemoRepos from "./components/DemoRepos";

<<<<<<< HEAD
const HEADY_API = import.meta.env.VITE_HEADY_API || "https://manager.headysystems.com";
=======
const HEADY_API = import.meta.env.VITE_HEADY_API || "http://localhost:3301/api";
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
const RESOURCE_POLL_MS = 5000;
const ORCHESTRATOR_POLL_MS = 8000;

// ─── Resource Health Hook ──────────────────────────────────────────────────

function useResourceHealth() {
  const [resourceData, setResourceData] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch(`${HEADY_API}/api/resources/health`);
        if (res.ok) setResourceData(await res.json());
      } catch (_) { /* endpoint may not be running yet */ }
    }
    poll();
    timerRef.current = setInterval(poll, RESOURCE_POLL_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  return resourceData;
}

// ─── Pipeline State Hook ───────────────────────────────────────────────────

function usePipelineState(enabled) {
  const [pipelineState, setPipelineState] = useState({});
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    async function poll() {
      try {
        const res = await fetch(`${HEADY_API}/api/buddy/orchestrator`);
        if (!res.ok) return;
        const data = await res.json();
        const cont = data.pipeline?.continuous || {};
        setPipelineState({
          currentTask: cont.running ? `Cycle ${cont.cycleCount}` : null,
          currentStage: cont.running ? "build_integrate" : "",
          cycleCount: cont.cycleCount || 0,
          continuousMode: cont.running || false,
          nodesActive: data.nodes?.active || 0,
          nodesTotal: data.nodes?.total || 0,
          gates: cont.gates || {},
          exitReason: cont.exitReason || null,
        });
      } catch (_) { /* not connected */ }
    }
    poll();
    timerRef.current = setInterval(poll, ORCHESTRATOR_POLL_MS);
    return () => clearInterval(timerRef.current);
  }, [enabled]);

  return pipelineState;
}

// ─── State Synchronization ──────────────────────────────────────────────
const syncState = useCallback(async (state) => {
  try {
    await fetch(`${HEADY_API}/api/buddy/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
  } catch (err) {
    console.error('State sync failed:', err);
  }
}, []);

// On state changes, sync to server
useEffect(() => {
  if (viewState === 'pill') return; // Don't sync in minimal state
  
  syncState({
    messages,
    viewState,
    pipelineState,
    config
  });
}, [messages, viewState, pipelineState, config, syncState]);

// On startup, fetch state from server
useEffect(() => {
  async function fetchState() {
    try {
      const res = await fetch(`${HEADY_API}/api/buddy/state`);
      if (!res.ok) return;
      
      const remoteState = await res.json();
      if (remoteState.messages) setMessages(remoteState.messages);
      if (remoteState.viewState) setViewState(remoteState.viewState);
      if (remoteState.pipelineState) setPipelineState(remoteState.pipelineState);
      if (remoteState.config) setConfig(remoteState.config);
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  }
  
  fetchState();
}, []);

// ─── App ───────────────────────────────────────────────────────────────────

export default function App() {
  const [viewState, setViewState] = useState("pill"); // pill | main | expanded
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | success | error
  const [config, setConfig] = useState(null);
  const resourceData = useResourceHealth();
  const pipelineState = usePipelineState(viewState === "expanded");

<<<<<<< HEAD
  // ─── State Synchronization ────────────────────────────────────────────
  const syncState = useCallback(async (state) => {
    try {
      await fetch(`${HEADY_API}/api/buddy/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
    } catch (err) {
      console.error('State sync failed:', err);
    }
  }, []);

  // On state changes, sync to server
  useEffect(() => {
    if (viewState === 'pill') return;
    syncState({ messages, viewState, pipelineState, config });
  }, [messages, viewState, pipelineState, config, syncState]);

  // On startup, fetch state from server
  useEffect(() => {
    async function fetchState() {
      try {
        const res = await fetch(`${HEADY_API}/api/buddy/state`);
        if (!res.ok) return;
        const remoteState = await res.json();
        if (remoteState.messages) setMessages(remoteState.messages);
        if (remoteState.viewState) setViewState(remoteState.viewState);
        if (remoteState.config) setConfig(remoteState.config);
      } catch (err) {
        console.error('Failed to fetch state:', err);
      }
    }
    fetchState();
  }, []);

=======
>>>>>>> heady-testing/claude/autonomous-agent-system-prompt-qarZg
  useEffect(() => {
    fetch(`${HEADY_API}/api/headybuddy-config`)
      .then(response => response.json())
      .then(data => setConfig(data));
  }, []);

  const handleSend = useCallback(async (text) => {
    if (!text.trim()) return;

    const userMsg = { role: "user", content: text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setStatus("thinking");

    try {
      const res = await fetch(`${HEADY_API}/api/buddy/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages.slice(-10) }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();
      const assistantMsg = {
        role: "assistant",
        content: data.reply || data.message || "I'm here to help!",
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStatus("success");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      const errMsg = {
        role: "assistant",
        content: `Connection issue — I'll keep trying. (${err.message})`,
        ts: Date.now(),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [messages]);

  const handleSuggestion = useCallback((chip) => {
    handleSend(chip);
  }, [handleSend]);

  if (viewState === "expanded") {
    return (
      <ExpandedView
        status={status}
        messages={messages}
        onSend={handleSend}
        onCollapse={() => setViewState("main")}
        resourceData={resourceData}
        pipelineState={pipelineState}
        config={config}
      >
        <CrossDeviceSync userId={config?.user?.id} />
        <DemoRepos />
      </ExpandedView>
    );
  }

  if (viewState === "main") {
    return (
      <MainWidget
        status={status}
        messages={messages}
        onSend={handleSend}
        onCollapse={() => setViewState("pill")}
        onExpand={() => setViewState("expanded")}
        onSuggestion={handleSuggestion}
        resourceData={resourceData}
        config={config}
      />
    );
  }

  return (
    <CollapsedPill
      status={status}
      onExpand={() => setViewState("main")}
      onSuggestion={handleSuggestion}
      resourceData={resourceData}
      config={config}
    />
  );
}
