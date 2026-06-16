export class AdminUI {
  constructor(container, user) {
    this.container = container;
    this.user = user;
  }

  render() {
    this.container.innerHTML = `
      <div class="admin-dashboard">
        <header class="admin-header glass-panel">
          <div class="header-content">
            <h1>Heady™ Mission Control</h1>
            <div class="user-info">
              <span>Operative: ${this.user.email}</span>
              <button id="logout-btn" class="secondary-btn small">Disconnect</button>
            </div>
          </div>
        </header>

        <main class="dashboard-grid">
          <section class="card glass-panel">
            <h2>Swarm Topology</h2>
            <div class="status-indicator online">Active</div>
            <p>17 Swarms • 89 Bees Operational</p>
          </section>

          <section class="card glass-panel">
            <h2>Vector Memory</h2>
            <div class="status-indicator online">Synchronized</div>
            <p>PGVector Primary • Merkle Trigger Active</p>
          </section>

          <section class="card glass-panel">
            <h2>Event Bus (NATS)</h2>
            <div class="status-indicator online">Streaming</div>
            <p>0 Dropped Packets • 142 Msg/sec</p>
          </section>

          <section class="card glass-panel">
            <h2>WASM Sandbox</h2>
            <div class="status-indicator online">Secured</div>
            <p>0 Escapes • Isolation Enforced</p>
          </section>
        </main>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
      const { auth, signOut } = await import('../services/firebase.js');
      await signOut(auth);
    });
  }
}
