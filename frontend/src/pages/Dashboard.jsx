import React, { useState, useEffect } from 'react';

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function SubsystemCard({ title, status, children }) {
  const statusColor = status === 'active' || status === 'online' || status === 'healthy'
    ? 'var(--accent, #00d4aa)'
    : status === 'offline' ? 'var(--text-secondary, #9898a8)'
    : '#f0a030';
  return (
    <div className="glass" style={{ padding: 'var(--space-lg, 21px)', marginBottom: 'var(--space-md, 13px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm, 8px)', marginBottom: 'var(--space-sm, 8px)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
        <h4 style={{ margin: 0 }}>{title}</h4>
        <span className="tag" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>{status}</span>
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [subsystems, setSubsystems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch dashboard status and subsystems in parallel
    Promise.all([
      fetch('/api/dashboard/status')
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
      fetch('/api/subsystems')
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
        .catch(() => null), // Subsystems are optional — don't block dashboard
    ])
      .then(([dashData, subData]) => { setData(dashData); setSubsystems(subData); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="page"><h2>Dashboard</h2><p className="error">Failed to load: {error}</p></div>;
  if (!data) return <div className="page"><h2>Dashboard</h2><p>Loading...</p></div>;

  const { system, agents, memory, resources } = data;
  const memPct = resources ? Math.round((1 - resources.freeMemoryMB / resources.totalMemoryMB) * 100) : 0;

  return (
    <div className="page">
      <h2>Dashboard</h2>
      <div className="stat-grid">
        <StatCard label="Status" value={system?.status?.toUpperCase()} sub={`v${system?.version}`} />
        <StatCard label="Uptime" value={formatUptime(system?.uptime)} sub={system?.environment} />
        <StatCard label="Agents" value={agents?.total} sub={`${agents?.working || 0} active`} />
        <StatCard label="Memories" value={memory?.entries} />
        <StatCard label="CPUs" value={resources?.cpus} sub={`load: ${resources?.loadAvg?.[0]?.toFixed(2)}`} />
        <StatCard label="Memory" value={`${memPct}%`} sub={`${resources?.freeMemoryMB} MB free`} />
      </div>

      {agents?.categories && (
        <div className="section">
          <h3>Agent Categories</h3>
          <div className="tag-list">
            {agents.categories.map(c => <span key={c} className="tag">{c}</span>)}
          </div>
        </div>
      )}

      {/* ── Subsystem Infrastructure ── */}
      {subsystems && (
        <div className="section" style={{ marginTop: 'var(--space-xl, 34px)' }}>
          <h3>Subsystem Infrastructure</h3>

          {/* Colab Runtime Cluster */}
          <SubsystemCard
            title="Colab Runtime Cluster"
            status={subsystems.colabCluster?.status || 'offline'}
          >
            {subsystems.colabCluster?.nodes ? (
              <div className="stat-grid" style={{ gap: 'var(--space-sm, 8px)' }}>
                {subsystems.colabCluster.nodes.map(node => (
                  <div key={node.id} className="stat-card" style={{ padding: 'var(--space-sm, 8px)' }}>
                    <div className="stat-value" style={{ fontSize: '1rem' }}>{node.codename || node.id}</div>
                    <div className="stat-label">{node.role || 'runtime'}</div>
                    <div className="stat-sub">{node.state || node.status || '—'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="stat-sub">3 A100 runtimes (Cortex, Synapse, Reflex)</div>
            )}
          </SubsystemCard>

          {/* Swarm Coordinator */}
          <SubsystemCard
            title="Swarm Coordinator"
            status={subsystems.swarmCoordinator?.status || 'offline'}
          >
            <div className="stat-sub">
              {subsystems.swarmCoordinator?.activeSwarms != null
                ? `${subsystems.swarmCoordinator.activeSwarms} active swarms`
                : '17 swarms defined (HeadyBee + HeadySwarm)'}
            </div>
          </SubsystemCard>

          {/* Bee Factory */}
          <SubsystemCard
            title="Bee Factory"
            status={subsystems.beeFactory?.status || 'offline'}
          >
            <div className="stat-sub">
              {subsystems.beeFactory?.totalBees != null
                ? `${subsystems.beeFactory.totalBees} bees across pools`
                : 'CSL-gated bee routing with phi-scaling'}
            </div>
          </SubsystemCard>

          {/* Universal Agent Prompt */}
          <SubsystemCard
            title="Universal Agent Prompt"
            status={subsystems.universalPrompt?.loaded ? 'active' : 'offline'}
          >
            <div style={{ display: 'flex', gap: 'var(--space-lg, 21px)', flexWrap: 'wrap' }}>
              <div className="stat-sub">Hash: {subsystems.universalPrompt?.hash?.slice(0, 12) || '—'}...</div>
              <div className="stat-sub">Archetypes: {subsystems.universalPrompt?.archetypeCount || 0}</div>
              <div className="stat-sub">Swarms: {subsystems.universalPrompt?.swarmCount || 0}</div>
              <div className="stat-sub">Colab Runtimes: {subsystems.universalPrompt?.colabRuntimeCount || 0}</div>
            </div>
          </SubsystemCard>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}
