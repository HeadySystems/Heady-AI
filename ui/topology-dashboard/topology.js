/**
 * © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Liquid Topology Dashboard — Client-side rendering.
 * Renders 3D topology on canvas, populates node/layer/connection panels.
 *
 * Founder: Eric Haywood
 */

(function () {
  'use strict';

  const PHI = 1.6180339887;
  const PSI = 0.6180339887;
  const PSI2 = PSI * PSI;

  // ── Dynamic Topology Data ──────────

  let NODES = [];
  let CONNECTIONS = [];

  const protocol = window.location.protocol === 'file:' ? 'http:' : window.location.protocol;
  const hostname = window.location.hostname || 'localhost';
  const managerUrl = `${protocol}//${hostname}:3300/api/registry`;

  // Pseudorandom seeded by string
  function seededRandom(seedStr) {
      let h = 0;
      for (let i = 0; i < seedStr.length; i++) h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
      return function() {
          h = Math.imul(h ^ h >>> 16, 2246822507);
          h = Math.imul(h ^ h >>> 13, 3266489909);
          return (h ^= h >>> 16) >>> 0;
      }
  }

  async function fetchTopologyData() {
      try {
          const res = await fetch(managerUrl);
          if (!res.ok) throw new Error('Network response was not ok');
          const registry = await res.json();

          NODES = [];
          CONNECTIONS = [];

          // Generate deterministic coordinates based on node ID
          const assignVector = (id, basePlatform) => {
              const rand = seededRandom(id);
              let baseVec = { x: rand() % 2, y: rand() % 2, z: rand() % 2 };

              // Apply layer anchors
              if (basePlatform === 'cloudflare') baseVec = { x: 1.0 + (rand()%10)/20, y: (rand()%10)/20, z: PHI + (rand()%10)/20 };
              else if (basePlatform === 'colab') baseVec = { x: (rand()%10)/20, y: PHI + (rand()%10)/20, z: (rand()%10)/20 };
              else if (basePlatform === 'vertex') baseVec = { x: PSI + (rand()%10)/20, y: 1.0 + (rand()%10)/20, z: PSI + (rand()%10)/20 };
              else baseVec = { x: PSI2 + (rand()%10)/20, y: PSI2 + (rand()%10)/20, z: PSI2 + (rand()%10)/20 }; // default origin

              return baseVec;
          };

          // Add Manager as central hub
          NODES.push({
              id: 'origin-manager',
              name: 'Heady Manager',
              platform: 'cloud_run',
              type: 'service',
              vector: { x: PSI2, y: PSI2, z: PSI2 },
              status: 'active'
          });

          // Map registry nodes
          if (registry.nodes) {
              for (const [id, node] of Object.entries(registry.nodes)) {
                  const platform = node.platform || (id.includes('EDGE') ? 'cloudflare' : 'local');
                  NODES.push({
                      id: id.toLowerCase(),
                      name: node.name || id,
                      platform: platform,
                      type: node.role || 'node',
                      vector: assignVector(id, platform),
                      status: node.status || 'unknown'
                  });

                  // Connect to manager
                  CONNECTIONS.push({
                      from: 'origin-manager',
                      to: id.toLowerCase(),
                      type: 'mesh',
                      weight: (seededRandom(id)() % 100) / 100 * PHI
                  });
              }
          }

          // Render panels if data successfully mapped
          if (NODES.length > 0) {
              populateNodeList();
              populateLayers();
              populateConnections();
              populateRoutingStats();
              updateClusterHealth();
          }

      } catch (error) {
          console.error("Failed to load topology data:", error);
      }
  }

  const PLATFORM_COLORS = {
    cloudflare: '#06b6d4',
    colab: '#f59e0b',
    vertex: '#8b5cf6',
    cloud_run: '#10b981',
    local: '#10b981',
  };

  const STATUS_COLORS = {
    active: '#10b981',
    degraded: '#f59e0b',
    quarantined: '#ef4444',
    standby: '#6b7280',
    unreachable: '#dc2626',
  };

  // ── 3D Canvas Rendering ──────────────────────────────────────────

  const canvas = document.getElementById('topology-canvas');
  const ctx = canvas.getContext('2d');
  let rotation = 0;

  function project3D(x, y, z, width, height) {
    const scale = 100;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rx = x * cos - z * sin;
    const rz = x * sin + z * cos;
    const perspective = 4 / (4 + rz * 0.5);
    return {
      px: width / 2 + rx * scale * perspective,
      py: height / 2 - y * scale * perspective + rz * 20 * perspective,
      depth: rz,
    };
  }

  function drawTopology() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const x = (w / 10) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      const y = (h / 10) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Project all nodes
    const projected = NODES.map(node => ({
      ...node,
      ...project3D(node.vector.x, node.vector.y, node.vector.z, w, h),
    }));

    // Draw connections
    for (const conn of CONNECTIONS) {
      const from = projected.find(n => n.id === conn.from);
      const to = projected.find(n => n.id === conn.to);
      if (!from || !to) continue;

      ctx.beginPath();
      ctx.moveTo(from.px, from.py);
      ctx.lineTo(to.px, to.py);
      ctx.strokeStyle = 'rgba(100, 116, 139, ' + (0.2 + conn.weight * 0.15) + ')';
      ctx.lineWidth = conn.weight * 0.8;
      ctx.stroke();
    }

    // Sort by depth for correct overlap
    projected.sort((a, b) => a.depth - b.depth);

    // Draw nodes
    for (const node of projected) {
      const color = PLATFORM_COLORS[node.platform] || '#6b7280';
      const radius = 8 + (node.depth + 2) * 2;

      // Glow effect
      const gradient = ctx.createRadialGradient(node.px, node.py, 0, node.px, node.py, radius * 2);
      gradient.addColorStop(0, color + '40');
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.fillRect(node.px - radius * 2, node.py - radius * 2, radius * 4, radius * 4);

      // Node circle
      ctx.beginPath();
      ctx.arc(node.px, node.py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Status ring
      ctx.beginPath();
      ctx.arc(node.px, node.py, radius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = STATUS_COLORS[node.status] || '#6b7280';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, node.px, node.py + radius + 14);
    }

    // Axis indicators
    const axes = [
      { label: 'X', color: '#06b6d4', vec: { x: 2, y: 0, z: 0 } },
      { label: 'Y', color: '#f59e0b', vec: { x: 0, y: 2, z: 0 } },
      { label: 'Z', color: '#8b5cf6', vec: { x: 0, y: 0, z: 2 } },
    ];
    const origin = project3D(0, 0, 0, w, h);
    for (const axis of axes) {
      const tip = project3D(axis.vec.x, axis.vec.y, axis.vec.z, w, h);
      ctx.beginPath();
      ctx.moveTo(origin.px, origin.py);
      ctx.lineTo(tip.px, tip.py);
      ctx.strokeStyle = axis.color + '60';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = axis.color;
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(axis.label, tip.px + 5, tip.py - 5);
    }

    rotation += 0.003;
    requestAnimationFrame(drawTopology);
  }

  // ── Panel Population ─────────────────────────────────────────────

  function populateNodeList() {
    const container = document.getElementById('node-list');
    container.innerHTML = NODES.map(node => `
      <div class="node-card">
        <div>
          <div class="node-name">${node.name}</div>
          <div class="node-platform">${node.platform} · ${node.type}</div>
        </div>
        <div class="node-status">
          <span class="status-badge ${node.status}"></span>
          ${node.status}
        </div>
      </div>
    `).join('');
  }

  function populateLayers() {
    const container = document.getElementById('layers-status');
    const layers = [
      { key: 'edge', name: 'Edge Layer', platform: 'cloudflare', anchor: `(1.0, 0.0, ${PHI.toFixed(3)})` },
      { key: 'compute', name: 'Compute Layer', platform: 'colab', anchor: `(0.0, ${PHI.toFixed(3)}, 0.0)` },
      { key: 'ai', name: 'AI Layer', platform: 'vertex', anchor: `(${PSI.toFixed(3)}, 1.0, ${PSI.toFixed(3)})` },
      { key: 'origin', name: 'Origin Layer', platform: 'cloud_run', anchor: `(${PSI2.toFixed(3)}, ${PSI2.toFixed(3)}, ${PSI2.toFixed(3)})` },
    ];

    container.innerHTML = layers.map(layer => {
      const count = NODES.filter(n => n.platform === layer.platform || (layer.platform === 'cloud_run' && n.platform === 'local')).length;
      return `
        <div class="layer-card ${layer.key}">
          <h3>${layer.name}</h3>
          <div class="layer-count">${count} nodes · anchor ${layer.anchor}</div>
        </div>
      `;
    }).join('');
  }

  function populateConnections() {
    const container = document.getElementById('connections-list');
    container.innerHTML = CONNECTIONS.map(conn => `
      <div class="connection-card">
        <div class="conn-path">${conn.from} → ${conn.to}</div>
        <div class="conn-weight">${conn.type} · weight: ${conn.weight.toFixed(3)}</div>
      </div>
    `).join('');
  }

  function populateRoutingStats() {
    const container = document.getElementById('routing-stats');
    const stats = [
      { label: 'Active Nodes', value: NODES.filter(n => n.status === 'active').length },
      { label: 'Total Nodes', value: NODES.length },
      { label: 'Connections', value: CONNECTIONS.length },
      { label: 'Avg Weight', value: (CONNECTIONS.reduce((s, c) => s + c.weight, 0) / CONNECTIONS.length).toFixed(3) },
      { label: 'Dimensions', value: '3D (x,y,z)' },
      { label: 'Scale', value: `φ = ${PHI.toFixed(3)}` },
    ];

    container.innerHTML = stats.map(s => `
      <div class="metric-row">
        <span class="metric-label">${s.label}</span>
        <span class="metric-value">${s.value}</span>
      </div>
    `).join('');
  }

  function updateClusterHealth() {
    const activeCount = NODES.filter(n => n.status === 'active').length;
    const ratio = activeCount / NODES.length;
    const el = document.getElementById('cluster-health');
    const dot = el.querySelector('.health-dot');
    const label = el.querySelector('.health-label');

    if (ratio >= 0.882) {
      label.textContent = 'Cluster Healthy';
      dot.className = 'health-dot';
    } else if (ratio >= 0.691) {
      label.textContent = 'Cluster Degraded';
      dot.className = 'health-dot degraded';
    } else {
      label.textContent = 'Cluster Critical';
      dot.className = 'health-dot critical';
    }
  }

  // ── Initialize ───────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', async function () {
    await fetchTopologyData();
    drawTopology();
    setInterval(fetchTopologyData, 15000); // refresh every 15s
  });
})();
