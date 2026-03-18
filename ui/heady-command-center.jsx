import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// HeadyOS × MAXIMUM POTENTIAL — Command Center
// φ-scaled architecture · concurrent execution · zero placeholders
// ═══════════════════════════════════════════════════════════════

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377];

const CSL_GATES = {
  SUPPRESS: { value: 0.236, label: "SUPPRESS", color: "#ff4757" },
  INCLUDE: { value: 0.382, label: "INCLUDE", color: "#ffa502" },
  BOOST: { value: 0.618, label: "BOOST", color: "#2ed573" },
  INJECT: { value: 0.718, label: "INJECT", color: "#1e90ff" },
  HIGH: { value: 0.882, label: "HIGH", color: "#7c4dff" },
  CRITICAL: { value: 0.927, label: "CRITICAL", color: "#ff6b9d" },
};

const AGENTS = [
  { id: "brain", name: "Brain", role: "Central Cognitive Engine", tier: "Premium", concurrency: 3, icon: "🧠" },
  { id: "researcher", name: "Researcher", role: "Autonomous Deep Research", tier: "Premium", concurrency: 2, icon: "🔬" },
  { id: "devops", name: "DevOps", role: "Platform Monitoring & Deploy", tier: "Standard", concurrency: 3, icon: "⚙️" },
  { id: "content", name: "Content", role: "CMS Publishing (9 sites)", tier: "Standard", concurrency: 3, icon: "📝" },
  { id: "jules", name: "Jules", role: "Task Automation & Scheduling", tier: "Fast", concurrency: 5, icon: "⚡" },
  { id: "builder", name: "Builder", role: "Code Generation & Scaffolding", tier: "Premium", concurrency: 2, icon: "🏗️" },
  { id: "observer", name: "Observer", role: "System Monitoring & Alerting", tier: "Fast", concurrency: 5, icon: "👁️" },
  { id: "sentinel", name: "Sentinel", role: "Security Scanning & Threats", tier: "Standard", concurrency: 2, icon: "🛡️" },
  { id: "atlas", name: "Atlas", role: "Data Mapping & Integration", tier: "Standard", concurrency: 3, icon: "🗺️" },
  { id: "muse", name: "Muse", role: "Creative Content & Copy", tier: "Premium", concurrency: 2, icon: "🎨" },
  { id: "sophia", name: "Sophia", role: "Knowledge Synthesis & Learning", tier: "Premium", concurrency: 2, icon: "📚" },
];

const PIPELINE_STAGES = [
  { id: 1, name: "Ingest", desc: "Gather all inputs", phase: "input" },
  { id: 2, name: "Validate", desc: "Schema & format checks", phase: "input" },
  { id: 3, name: "Classify", desc: "CSL gate routing", phase: "input" },
  { id: 4, name: "Enrich", desc: "Context augmentation", phase: "process" },
  { id: 5, name: "Plan", desc: "Decompose into DAG", phase: "process" },
  { id: 6, name: "Route", desc: "Agent capability match", phase: "process" },
  { id: 7, name: "Execute", desc: "Concurrent task pool", phase: "execute" },
  { id: 8, name: "Synthesize", desc: "Merge agent outputs", phase: "execute" },
  { id: 9, name: "Verify", desc: "Prove correctness", phase: "verify" },
  { id: 10, name: "Critique", desc: "Self-review pass", phase: "verify" },
  { id: 11, name: "Optimize", desc: "Refactor & compress", phase: "output" },
  { id: 12, name: "Deliver", desc: "Package artifacts", phase: "output" },
  { id: 13, name: "Learn", desc: "Store to vector memory", phase: "output" },
];

const PIPELINE_VARIANTS = [
  { name: "FAST", stages: 8, color: "#2ed573", use: "Simple tasks, low latency" },
  { name: "STANDARD", stages: 13, color: "#1e90ff", use: "Normal HCFP flow" },
  { name: "FULL", stages: 21, color: "#7c4dff", use: "Complete analysis" },
  { name: "ARENA", stages: 15, color: "#ff6b9d", use: "Multi-model competition" },
  { name: "LEARNING", stages: 13, color: "#ffa502", use: "Self-improvement loops" },
];

const META_PROMPTS = [
  { id: "MT-001", name: "Prompt Optimizer", size: "L", desc: "Rewrite prompts for max effectiveness" },
  { id: "MT-002", name: "Prompt Debugger", size: "M", desc: "Diagnose why a prompt is failing" },
  { id: "MT-003", name: "Prompt Compressor", size: "S", desc: "Cut tokens without losing quality" },
  { id: "MT-006", name: "Response Quality Audit", size: "L", desc: "7-point internal quality checklist" },
  { id: "MT-008", name: "Context Window Mgmt", size: "M", desc: "Summarize & restore conversation state" },
  { id: "MT-010", name: "Conversation Structure", size: "L", desc: "Structure complex task workflows" },
  { id: "MT-013", name: "Chain-of-Thought", size: "S", desc: "Step-by-step reasoning trigger" },
  { id: "MT-014", name: "Multi-Perspective", size: "M", desc: "Pragmatist × Perfectionist × Skeptic" },
  { id: "MT-016", name: "Knowledge Extraction", size: "M", desc: "Extract reusable decisions & patterns" },
];

const DELIVERY_CHECKLIST = [
  "All code compiles without errors",
  "All services respond to health checks",
  "All APIs have request/response validation",
  "All error paths handled with typed errors",
  "All config uses env vars with defaults",
  "All secrets externalized — never hardcoded",
  "CORS uses explicit origin whitelists",
  "Structured JSON logs with correlation IDs",
  "Dependencies pinned to exact versions",
  "No TODO, FIXME, HACK comments remain",
  "No console.log in production code",
  "No hardcoded URLs, ports, or credentials",
  "Tests exist and pass for critical paths",
  "Docs exist for setup, config, and deploy",
];

const COGNITIVE_LAYERS = [
  { name: "Wisdom", icon: "💎", desc: "First principles — what is the actual problem?" },
  { name: "Awareness", icon: "🌐", desc: "360° context — dependencies, impacts, constraints" },
  { name: "Creativity", icon: "✨", desc: "Lateral thinking — simpler paths, composable patterns" },
  { name: "Multiplicity", icon: "🔀", desc: "3+ approaches before committing to one" },
  { name: "Thoroughness", icon: "🔍", desc: "Zero-skip — every file, every import, every test" },
  { name: "Memory", icon: "🧬", desc: "Perfect recall — patterns compound across tasks" },
  { name: "Architecture", icon: "🏛️", desc: "Clean structure — SoC, DI, stable interfaces" },
];

// ── Utilities ──────────────────────────────────────────────────
function phiScale(base, power) {
  return Math.round(base * Math.pow(PHI, power));
}

function cslGate(score) {
  if (score >= 0.927) return CSL_GATES.CRITICAL;
  if (score >= 0.882) return CSL_GATES.HIGH;
  if (score >= 0.718) return CSL_GATES.INJECT;
  if (score >= 0.618) return CSL_GATES.BOOST;
  if (score >= 0.382) return CSL_GATES.INCLUDE;
  return CSL_GATES.SUPPRESS;
}

// ── Components ─────────────────────────────────────────────────

function PhiBackground() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{
        position: "absolute", width: "100%", height: "100%",
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(0,212,170,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 60% 80% at 80% 90%, rgba(124,77,255,0.05) 0%, transparent 60%),
          radial-gradient(ellipse 50% 50% at 50% 50%, rgba(30,144,255,0.03) 0%, transparent 70%)
        `
      }} />
      {FIB.slice(3, 10).map((f, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${(f * 7 + i * 13) % 90}%`,
          top: `${(f * 11 + i * 17) % 85}%`,
          width: f * 2,
          height: f * 2,
          borderRadius: "50%",
          border: `1px solid rgba(0,212,170,${0.03 + i * 0.01})`,
          animation: `spin ${f * 3}s linear infinite`,
        }} />
      ))}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function NavTab({ label, active, onClick, count }) {
  return (
    <button onClick={onClick} style={{
      padding: "10px 18px",
      background: active ? "rgba(0,212,170,0.15)" : "transparent",
      border: active ? "1px solid rgba(0,212,170,0.4)" : "1px solid transparent",
      borderRadius: 8,
      color: active ? "#00d4aa" : "#9898a8",
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      cursor: "pointer",
      transition: "all 0.25s ease",
      display: "flex",
      alignItems: "center",
      gap: 8,
      whiteSpace: "nowrap",
    }}>
      {label}
      {count != null && (
        <span style={{
          background: active ? "rgba(0,212,170,0.3)" : "rgba(255,255,255,0.08)",
          padding: "2px 7px",
          borderRadius: 10,
          fontSize: 11,
        }}>{count}</span>
      )}
    </button>
  );
}

function Card({ children, style, glow }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 13,
      padding: 21,
      position: "relative",
      overflow: "hidden",
      ...style,
    }}>
      {glow && <div style={{
        position: "absolute", top: -1, left: -1, right: -1, height: 2,
        background: `linear-gradient(90deg, transparent, ${glow}, transparent)`,
      }} />}
      {children}
    </div>
  );
}

function StatBox({ label, value, sub, color = "#00d4aa" }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#9898a8", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Tab: System Overview ───────────────────────────────────────
function OverviewTab() {
  const [healthPulse, setHealthPulse] = useState(0.7692);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setHealthPulse(prev => {
        const delta = (Math.random() - 0.48) * 0.02;
        return Math.max(0.7, Math.min(0.85, prev + delta));
      });
      setTick(t => t + 1);
    }, 2900);
    return () => clearInterval(iv);
  }, []);

  const gate = cslGate(healthPulse);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 21 }}>
      {/* Health Banner */}
      <Card glow={gate.color}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 13 }}>
          <div>
            <div style={{ fontSize: 11, color: "#9898a8", letterSpacing: 2, textTransform: "uppercase" }}>φ-Health Score</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 13, marginTop: 5 }}>
              <span style={{ fontSize: 42, fontWeight: 700, color: gate.color, fontFamily: "'JetBrains Mono', monospace" }}>
                {healthPulse.toFixed(4)}
              </span>
              <span style={{
                padding: "3px 10px",
                borderRadius: 6,
                background: `${gate.color}22`,
                color: gate.color,
                fontSize: 12,
                fontWeight: 600,
              }}>CSL: {gate.label}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 34, flexWrap: "wrap" }}>
            <StatBox label="MCP Tools" value="110" sub="v5.1.0" />
            <StatBox label="Agents" value="11" sub="17-swarm" color="#7c4dff" />
            <StatBox label="Endpoints" value="10/13" sub="Cloud Run" color="#1e90ff" />
            <StatBox label="Domains" value="10/13" sub="Active" color="#ffa502" />
          </div>
        </div>
      </Card>

      {/* Architecture Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 13 }}>
        <Card>
          <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 600, marginBottom: 13 }}>⚡ Concurrent Execution Model</div>
          <div style={{ fontSize: 12, color: "#c8c8d8", lineHeight: 1.7 }}>
            Independent tasks fire simultaneously via φ-scaled worker pools. No priority queues — semantic relevance gates route by capability match. Data dependencies are physics, not rankings. Fibonacci-based pool sizing: min={FIB[2]}, max={FIB[6]}.
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: "#7c4dff", fontWeight: 600, marginBottom: 13 }}>🧬 CSL — Confidence Signal Logic</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.values(CSL_GATES).map(g => (
              <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: `${g.value * 100}%`, minWidth: 30, height: 6, borderRadius: 3, background: g.color }} />
                <span style={{ fontSize: 11, color: g.color, fontFamily: "'JetBrains Mono', monospace", minWidth: 65 }}>{g.value.toFixed(3)}</span>
                <span style={{ fontSize: 11, color: "#9898a8" }}>{g.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 13, color: "#1e90ff", fontWeight: 600, marginBottom: 13 }}>🏛️ φ-Scaled Constants</div>
          <div style={{ fontSize: 12, color: "#c8c8d8", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 }}>
            <div>PHI = {PHI.toFixed(6)}</div>
            <div>PSI = {PSI.toFixed(6)}</div>
            <div>FAST = {phiScale(1000, 3).toLocaleString()}ms</div>
            <div>NORMAL = {phiScale(1000, 5).toLocaleString()}ms</div>
            <div>LONG = {phiScale(1000, 8).toLocaleString()}ms</div>
            <div>HEARTBEAT = {phiScale(1000, 7).toLocaleString()}ms</div>
          </div>
        </Card>
      </div>

      {/* Liquidity Layer */}
      <Card>
        <div style={{ fontSize: 13, color: "#ff6b9d", fontWeight: 600, marginBottom: 13 }}>🌊 Liquid Architecture — Failover Chains</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 13 }}>
          {[
            { label: "LLM Inference", chain: "AI Gateway → Gemini → GPT → Workers AI → vLLM" },
            { label: "Vector Search", chain: "CF Vectorize → pgvector/Neon → Upstash Vector" },
            { label: "Task Queues", chain: "Redis Streams → CF Queues → QStash" },
            { label: "Compute", chain: "Cloud Run → Azure ACA → CF Workers" },
            { label: "State", chain: "Redis (T0) → Neon (T1) → Cosmos (T2) → R2 (T3)" },
            { label: "GPU", chain: "Colab → HF Endpoints → Workers AI" },
          ].map(f => (
            <div key={f.label} style={{ fontSize: 12 }}>
              <span style={{ color: "#00d4aa", fontWeight: 600 }}>{f.label}:</span>
              <span style={{ color: "#9898a8", marginLeft: 8 }}>{f.chain}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Agent Swarm ───────────────────────────────────────────
function AgentsTab() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentStates, setAgentStates] = useState(() =>
    Object.fromEntries(AGENTS.map(a => [a.id, {
      active: Math.floor(Math.random() * a.concurrency),
      tasks: Math.floor(Math.random() * 12),
      score: 0.6 + Math.random() * 0.35,
      latency: Math.floor(50 + Math.random() * 200),
    }]))
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setAgentStates(prev => {
        const next = { ...prev };
        const ids = Object.keys(next);
        const id = ids[Math.floor(Math.random() * ids.length)];
        const agent = AGENTS.find(a => a.id === id);
        next[id] = {
          ...next[id],
          active: Math.floor(Math.random() * agent.concurrency),
          tasks: Math.max(0, next[id].tasks + Math.floor(Math.random() * 5) - 2),
          score: Math.max(0.4, Math.min(1, next[id].score + (Math.random() - 0.48) * 0.05)),
          latency: Math.max(20, next[id].latency + Math.floor(Math.random() * 40) - 18),
        };
        return next;
      });
    }, 1800);
    return () => clearInterval(iv);
  }, []);

  const tierColors = { Premium: "#7c4dff", Standard: "#1e90ff", Fast: "#2ed573" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 13 }}>
        {AGENTS.map(agent => {
          const state = agentStates[agent.id];
          const gate = cslGate(state.score);
          const isSelected = selectedAgent === agent.id;
          return (
            <Card key={agent.id} glow={isSelected ? gate.color : undefined} style={{
              cursor: "pointer",
              borderColor: isSelected ? `${gate.color}66` : undefined,
              transform: isSelected ? "scale(1.02)" : undefined,
            }}>
              <div onClick={() => setSelectedAgent(isSelected ? null : agent.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>{agent.icon}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    background: `${tierColors[agent.tier]}22`,
                    color: tierColors[agent.tier],
                  }}>{agent.tier}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#e8e8f0", marginTop: 8 }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: "#9898a8", marginTop: 2 }}>{agent.role}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 13, fontSize: 11 }}>
                  <span style={{ color: gate.color }}>{state.score.toFixed(3)} CSL</span>
                  <span style={{ color: "#9898a8" }}>{state.active}/{agent.concurrency} active</span>
                </div>
                <div style={{
                  marginTop: 8, height: 3, borderRadius: 2,
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}>
                  <div style={{
                    width: `${(state.active / agent.concurrency) * 100}%`,
                    height: "100%",
                    background: gate.color,
                    borderRadius: 2,
                    transition: "width 0.5s ease",
                  }} />
                </div>
                {isSelected && (
                  <div style={{ marginTop: 13, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#9898a8", display: "flex", flexDirection: "column", gap: 5 }}>
                      <div>Tasks queued: <span style={{ color: "#e8e8f0" }}>{state.tasks}</span></div>
                      <div>Avg latency: <span style={{ color: "#e8e8f0" }}>{state.latency}ms</span></div>
                      <div>Pool: <span style={{ color: "#e8e8f0" }}>Fibonacci({agent.concurrency})</span></div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Pipeline Engine ───────────────────────────────────────
function PipelineTab() {
  const [activeVariant, setActiveVariant] = useState("STANDARD");
  const [runningStage, setRunningStage] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);

  const variant = PIPELINE_VARIANTS.find(v => v.name === activeVariant);
  const visibleStages = PIPELINE_STAGES.slice(0, Math.min(variant.stages, PIPELINE_STAGES.length));

  const runPipeline = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setRunningStage(0);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i >= visibleStages.length) {
        clearInterval(iv);
        setIsRunning(false);
        setRunningStage(-1);
      } else {
        setRunningStage(i);
      }
    }, 400);
  }, [isRunning, visibleStages.length]);

  const phaseColors = { input: "#2ed573", process: "#1e90ff", execute: "#7c4dff", verify: "#ffa502", output: "#ff6b9d" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 21 }}>
      {/* Variant Selector */}
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#9898a8", marginRight: 8 }}>Variant:</span>
          {PIPELINE_VARIANTS.map(v => (
            <button key={v.name} onClick={() => { setActiveVariant(v.name); setRunningStage(-1); setIsRunning(false); }} style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: `1px solid ${activeVariant === v.name ? v.color : "rgba(255,255,255,0.08)"}`,
              background: activeVariant === v.name ? `${v.color}22` : "transparent",
              color: activeVariant === v.name ? v.color : "#9898a8",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: "pointer",
            }}>
              {v.name} ({v.stages})
            </button>
          ))}
          <button onClick={runPipeline} disabled={isRunning} style={{
            marginLeft: "auto",
            padding: "8px 20px",
            borderRadius: 8,
            border: "1px solid rgba(0,212,170,0.4)",
            background: isRunning ? "rgba(0,212,170,0.1)" : "rgba(0,212,170,0.2)",
            color: "#00d4aa",
            fontSize: 12,
            fontWeight: 600,
            cursor: isRunning ? "not-allowed" : "pointer",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {isRunning ? "⟳ Running..." : "▶ Simulate"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 8 }}>{variant.use}</div>
      </Card>

      {/* Pipeline Stages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {visibleStages.map((stage, idx) => {
          const isActive = idx === runningStage;
          const isDone = runningStage > idx;
          const pc = phaseColors[stage.phase];
          return (
            <div key={stage.id} style={{
              display: "flex", alignItems: "center", gap: 13,
              padding: "10px 16px",
              background: isActive ? `${pc}15` : isDone ? "rgba(46,213,115,0.05)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${isActive ? `${pc}55` : isDone ? "rgba(46,213,115,0.15)" : "rgba(255,255,255,0.04)"}`,
              borderRadius: 8,
              transition: "all 0.3s ease",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isActive ? `${pc}33` : isDone ? "rgba(46,213,115,0.2)" : "rgba(255,255,255,0.05)",
                color: isActive ? pc : isDone ? "#2ed573" : "#666",
                fontSize: 12, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {isDone ? "✓" : stage.id}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? pc : isDone ? "#c8c8d8" : "#9898a8" }}>
                  {stage.name}
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>{stage.desc}</div>
              </div>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                background: `${pc}15`,
                color: pc,
              }}>{stage.phase}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Cognitive Framework ───────────────────────────────────
function CognitiveTab() {
  const [activeLayers, setActiveLayers] = useState(new Set(["Wisdom", "Awareness"]));

  const toggleLayer = (name) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 21 }}>
      <Card>
        <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 600, marginBottom: 5 }}>7-Layer Cognitive Framework</div>
        <div style={{ fontSize: 12, color: "#9898a8" }}>
          Every task passes through all layers. Toggle to see active reasoning chains.
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {COGNITIVE_LAYERS.map((layer, i) => {
          const isActive = activeLayers.has(layer.name);
          const hue = (i / COGNITIVE_LAYERS.length) * 300;
          const color = `hsl(${hue}, 70%, 65%)`;
          return (
            <div key={layer.name} onClick={() => toggleLayer(layer.name)} style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "14px 18px",
              background: isActive ? `hsla(${hue}, 70%, 65%, 0.08)` : "rgba(255,255,255,0.02)",
              border: `1px solid ${isActive ? `hsla(${hue}, 70%, 65%, 0.3)` : "rgba(255,255,255,0.04)"}`,
              borderRadius: 10,
              cursor: "pointer",
              transition: "all 0.25s ease",
            }}>
              <span style={{ fontSize: 24 }}>{layer.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: isActive ? color : "#9898a8" }}>
                  Layer {i + 1}: {layer.name}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{layer.desc}</div>
              </div>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: isActive ? color : "rgba(255,255,255,0.1)",
                boxShadow: isActive ? `0 0 12px ${color}` : "none",
                transition: "all 0.3s ease",
              }} />
            </div>
          );
        })}
      </div>

      {/* Delivery Checklist */}
      <Card>
        <div style={{ fontSize: 13, color: "#ff6b9d", fontWeight: 600, marginBottom: 13 }}>✅ Delivery Standards — "Done" Means Done</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 6 }}>
          {DELIVERY_CHECKLIST.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#9898a8" }}>
              <span style={{ color: "#2ed573", fontSize: 10 }}>▪</span>
              {item}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Meta Prompts ──────────────────────────────────────────
function MetaTab() {
  const [selectedPrompt, setSelectedPrompt] = useState(null);

  const sizeColors = { S: "#2ed573", M: "#1e90ff", L: "#7c4dff" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
      <Card>
        <div style={{ fontSize: 13, color: "#ffa502", fontWeight: 600, marginBottom: 5 }}>🔮 Meta-Prompt Toolkit</div>
        <div style={{ fontSize: 12, color: "#9898a8" }}>
          Prompts about prompting — self-improvement, quality control, and workflow optimization.
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 13 }}>
        {META_PROMPTS.map(mp => {
          const isSelected = selectedPrompt === mp.id;
          return (
            <Card key={mp.id} style={{ cursor: "pointer", borderColor: isSelected ? "#ffa50266" : undefined }}
              glow={isSelected ? "#ffa502" : undefined}>
              <div onClick={() => setSelectedPrompt(isSelected ? null : mp.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#ffa502", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                    {mp.id}
                  </span>
                  <span style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    background: `${sizeColors[mp.size]}22`,
                    color: sizeColors[mp.size],
                  }}>Size: {mp.size}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8f0", marginTop: 8 }}>{mp.name}</div>
                <div style={{ fontSize: 12, color: "#9898a8", marginTop: 4 }}>{mp.desc}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Design System ─────────────────────────────────────────
function DesignTab() {
  const fibSpaces = [
    { name: "xs", val: 5 }, { name: "sm", val: 8 }, { name: "md", val: 13 },
    { name: "lg", val: 21 }, { name: "xl", val: 34 }, { name: "2xl", val: 55 }, { name: "3xl", val: 89 },
  ];

  const typeScale = [
    { name: "xs", rem: 0.75 }, { name: "sm", rem: 0.875 }, { name: "base", rem: 1 },
    { name: "lg", rem: 1.125 }, { name: "xl", rem: 1.618 }, { name: "2xl", rem: 2.618 },
  ];

  const retryBackoff = FIB.slice(4, 9).map(n => n * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 21 }}>
      {/* Fibonacci Spacing */}
      <Card>
        <div style={{ fontSize: 13, color: "#00d4aa", fontWeight: 600, marginBottom: 13 }}>📐 Fibonacci Spacing Scale</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fibSpaces.map(s => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ fontSize: 11, color: "#9898a8", fontFamily: "'JetBrains Mono', monospace", width: 40 }}>--{s.name}</span>
              <div style={{
                width: s.val * 2.5, height: 13, borderRadius: 3,
                background: `rgba(0,212,170,${0.2 + s.val * 0.005})`,
                border: "1px solid rgba(0,212,170,0.3)",
              }} />
              <span style={{ fontSize: 11, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>{s.val}px</span>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 13 }}>
        {/* Type Scale */}
        <Card>
          <div style={{ fontSize: 13, color: "#7c4dff", fontWeight: 600, marginBottom: 13 }}>🔤 Golden Ratio Type Scale</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {typeScale.map(t => (
              <div key={t.name} style={{ display: "flex", alignItems: "baseline", gap: 13 }}>
                <span style={{ fontSize: 11, color: "#9898a8", fontFamily: "'JetBrains Mono', monospace", width: 40 }}>--{t.name}</span>
                <span style={{ fontSize: t.rem * 16, color: "#e8e8f0", fontWeight: 500 }}>Aa</span>
                <span style={{ fontSize: 11, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>{t.rem}rem</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Retry Backoff */}
        <Card>
          <div style={{ fontSize: 13, color: "#ff6b9d", fontWeight: 600, marginBottom: 13 }}>🔁 Fibonacci Retry Backoff</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {retryBackoff.map((ms, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <span style={{ fontSize: 11, color: "#9898a8", fontFamily: "'JetBrains Mono', monospace", width: 60 }}>
                  Retry {i + 1}
                </span>
                <div style={{
                  width: `${(ms / 3400) * 100}%`,
                  height: 10,
                  borderRadius: 3,
                  background: `rgba(255,107,157,${0.2 + i * 0.1})`,
                  border: "1px solid rgba(255,107,157,0.3)",
                  minWidth: 20,
                }} />
                <span style={{ fontSize: 11, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>{ms}ms</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Pool Sizing */}
      <Card>
        <div style={{ fontSize: 13, color: "#1e90ff", fontWeight: 600, marginBottom: 13 }}>🧮 Connection Pool Sizing (Fibonacci)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 13 }}>
          {[
            { name: "DB Pool", min: FIB[2], max: FIB[6] },
            { name: "Worker Threads", min: FIB[3], max: FIB[7] },
            { name: "WebSocket", min: FIB[4], max: FIB[8] },
            { name: "Redis Connections", min: FIB[2], max: FIB[5] },
          ].map(p => (
            <div key={p.name} style={{
              padding: 13,
              background: "rgba(30,144,255,0.06)",
              borderRadius: 8,
              border: "1px solid rgba(30,144,255,0.15)",
            }}>
              <div style={{ fontSize: 12, color: "#1e90ff", fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#9898a8", marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                min: {p.min} — max: {p.max}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Security ──────────────────────────────────────────────
function SecurityTab() {
  const checks = [
    { cat: "Input", items: ["Input validation on all user data", "Output encoding to prevent XSS", "Parameterized queries — no SQL injection", "File upload validation (type, size, content)"] },
    { cat: "Auth", items: ["JWT with short expiry + refresh", "DPoP tokens (RFC 9449) for sender constraint", "Fibonacci key rotation (1,1,2,3,5,8 days)", "Rate limiting on auth endpoints"] },
    { cat: "Transport", items: ["HTTPS everywhere, HTTP redirects", "CORS whitelist — no wildcards", "Cookie flags: httpOnly, Secure, SameSite", "mTLS between Cloud Run services"] },
    { cat: "Secrets", items: ["GCP Secret Manager (primary)", "Azure Key Vault (backup)", "CF Worker env vars (emergency)", "Never in .env files or code"] },
    { cat: "Monitoring", items: ["Sentry errors + performance + profiling", "OpenTelemetry spans to Sentry OTel", "Sentry Crons on φ-heartbeat (29,034ms)", "Sentry Seer AI for auto-fix PRs"] },
  ];

  const catColors = ["#2ed573", "#1e90ff", "#7c4dff", "#ffa502", "#ff6b9d"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 13 }}>
      {checks.map((group, gi) => (
        <Card key={group.cat} glow={catColors[gi]}>
          <div style={{ fontSize: 13, color: catColors[gi], fontWeight: 600, marginBottom: 13 }}>
            {["🔒", "🗝️", "🔐", "🤫", "📡"][gi]} {group.cat}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.items.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#c8c8d8" }}>
                <span style={{ color: catColors[gi], fontSize: 10, marginTop: 3 }}>◆</span>
                {item}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
const TABS = [
  { key: "overview", label: "System Overview" },
  { key: "agents", label: "Agent Swarm", count: 11 },
  { key: "pipeline", label: "Pipeline Engine", count: 5 },
  { key: "cognitive", label: "Cognitive Framework" },
  { key: "meta", label: "Meta Prompts", count: META_PROMPTS.length },
  { key: "design", label: "Design System" },
  { key: "security", label: "Security" },
];

export default function HeadyCommandCenter() {
  const [activeTab, setActiveTab] = useState("overview");

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab />;
      case "agents": return <AgentsTab />;
      case "pipeline": return <PipelineTab />;
      case "cognitive": return <CognitiveTab />;
      case "meta": return <MetaTab />;
      case "design": return <DesignTab />;
      case "security": return <SecurityTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e8e8f0",
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      position: "relative",
    }}>
      <PhiBackground />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "21px 21px 55px" }}>
        {/* Header */}
        <div style={{ marginBottom: 21 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #00d4aa, #7c4dff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 700, color: "#0a0a0f",
            }}>H</div>
            <div>
              <div style={{
                fontSize: 20, fontWeight: 700,
                background: "linear-gradient(135deg, #00d4aa, #7c4dff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: -0.5,
              }}>
                HeadyOS × Maximum Potential
              </div>
              <div style={{ fontSize: 11, color: "#666", fontFamily: "'JetBrains Mono', monospace" }}>
                Command Center — φ-scaled architecture · concurrent execution · zero placeholders
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div style={{
          display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 21,
          padding: "5px 8px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          {TABS.map(tab => (
            <NavTab key={tab.key} label={tab.label} active={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)} count={tab.count} />
          ))}
        </div>

        {/* Content */}
        {renderTab()}
      </div>
    </div>
  );
}
