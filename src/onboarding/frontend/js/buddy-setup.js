/**
 * HeadyMe Onboarding — HeadyBuddy Setup (Stage 5)
 * Cognitive archetype selection, AI keys, interface toggles, preferred name, live preview.
 * ES2024 module — no dependencies.
 */

/* ---- 7 Cognitive Archetypes ---- */
const ARCHETYPES = [
  {
    id: 'OWL',
    icon: '\uD83E\uDD89',
    name: 'Owl',
    trait: 'Analytical & Methodical',
    description: 'The Owl is your deep-thinking companion. Meticulous, research-oriented, and thorough — ideal for complex analysis, academic work, and detailed planning. Prefers structured reasoning and evidence-based responses.',
  },
  {
    id: 'EAGLE',
    icon: '\uD83E\uDD85',
    name: 'Eagle',
    trait: 'Visionary & Strategic',
    description: 'The Eagle sees the big picture. Strategic, goal-oriented, and decisive — perfect for leadership tasks, project planning, and high-level architecture. Focuses on outcomes and long-term impact.',
  },
  {
    id: 'DOLPHIN',
    icon: '\uD83D\uDC2C',
    name: 'Dolphin',
    trait: 'Creative & Collaborative',
    description: 'The Dolphin thrives on creativity and connection. Playful, empathetic, and communicative — great for brainstorming, writing, design, and team collaboration. Balances fun with productivity.',
  },
  {
    id: 'RABBIT',
    icon: '\uD83D\uDC07',
    name: 'Rabbit',
    trait: 'Fast & Adaptive',
    description: 'The Rabbit is lightning-fast and responsive. Quick to act, adaptable, and efficient — ideal for rapid prototyping, quick tasks, and real-time problem solving. Prioritizes speed without sacrificing quality.',
  },
  {
    id: 'ANT',
    icon: '\uD83D\uDC1C',
    name: 'Ant',
    trait: 'Systematic & Persistent',
    description: 'The Ant excels at systematic execution. Organized, tireless, and detail-focused — perfect for data processing, repetitive tasks, and building robust systems. Never drops a task.',
  },
  {
    id: 'ELEPHANT',
    icon: '\uD83D\uDC18',
    name: 'Elephant',
    trait: 'Wise & Memory-Rich',
    description: 'The Elephant remembers everything. Context-aware, patient, and deeply knowledgeable — excellent for long-running projects, mentoring, and maintaining continuity across sessions.',
  },
  {
    id: 'BEAVER',
    icon: '\uD83E\uDD9B',
    name: 'Beaver',
    trait: 'Builder & Engineer',
    description: 'The Beaver builds things that last. Practical, industrious, and quality-focused — the go-to for software engineering, infrastructure, DevOps, and hands-on construction of systems.',
  },
];

/* ---- Interface Registry ---- */
const INTERFACES = [
  { id: 'dashboard',   name: 'Dashboard',         icon: '\uD83D\uDCCA', default: true },
  { id: 'agents',      name: 'Agents',            icon: '\uD83E\uDD16', default: true },
  { id: 'memory',      name: 'Memory',            icon: '\uD83E\uDDE0', default: true },
  { id: 'deploy',      name: 'Deploy',            icon: '\uD83D\uDE80', default: false },
  { id: 'docs',        name: 'Docs',              icon: '\uD83D\uDCDA', default: true },
  { id: 'mobile',      name: 'HeadyBuddy Mobile', icon: '\uD83D\uDCF1', default: false },
  { id: 'mcp',         name: 'MCP Server',        icon: '\uD83D\uDD0C', default: false },
  { id: 'headybot',    name: 'HeadyBot',          icon: '\uD83D\uDCAC', default: true },
];

/* ---- AI Provider Keys (Tier 3) ---- */
const AI_KEY_FIELDS = [
  { id: 'openai',     name: 'OpenAI',       placeholder: 'sk-...' },
  { id: 'anthropic',  name: 'Anthropic',     placeholder: 'sk-ant-...' },
  { id: 'google',     name: 'Google AI',     placeholder: 'AIza...' },
  { id: 'perplexity', name: 'Perplexity',    placeholder: 'pplx-...' },
  { id: 'mistral',    name: 'Mistral',       placeholder: '' },
  { id: 'cohere',     name: 'Cohere',        placeholder: '' },
  { id: 'groq',       name: 'Groq',          placeholder: 'gsk_...' },
  { id: 'replicate',  name: 'Replicate',     placeholder: 'r8_...' },
  { id: 'together',   name: 'Together AI',   placeholder: '' },
  { id: 'fireworks',  name: 'Fireworks',     placeholder: '' },
  { id: 'deepseek',   name: 'DeepSeek',      placeholder: '' },
  { id: 'xai',        name: 'xAI',           placeholder: '' },
];

export class BuddySetup {
  #container = null;
  #state = {
    preferredName: '',
    archetype: 'OWL',
    interfaces: new Set(INTERFACES.filter(i => i.default).map(i => i.id)),
    aiKeys: {},
  };
  #onUpdate = null;

  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.container
   * @param {string} opts.displayName – pre-fill from Stage 2
   * @param {Function} opts.onUpdate – called with state changes
   */
  constructor({ container, displayName = '', onUpdate }) {
    this.#container = container;
    this.#state.preferredName = displayName?.split(' ')[0] || '';
    this.#onUpdate = onUpdate;
    this.#render();
    this.#bindEvents();
    this.#updatePreview();
  }

  getState() {
    return {
      preferredName: this.#state.preferredName,
      archetype: this.#state.archetype,
      interfaces: [...this.#state.interfaces],
      aiKeys: { ...this.#state.aiKeys },
    };
  }

  /* ---- Render ---- */

  #render() {
    this.#container.innerHTML = `
      <h2 class="stage-heading" tabindex="-1">
        Meet HeadyBuddy <span style="display:inline-block; animation: celebrateBounce 0.6s ease;">\uD83E\uDDE0</span>
      </h2>
      <p class="stage-subheading">
        Personalize your AI companion. Everything here can be changed later in Settings.
      </p>

      <!-- Preferred Name -->
      <div class="form-group">
        <label class="form-label" for="buddy-name">What should Buddy call you?</label>
        <input class="form-input" type="text" id="buddy-name"
               placeholder="Your first name or nickname"
               value="${this.#escapeAttr(this.#state.preferredName)}"
               maxlength="50" autocomplete="given-name"
               aria-describedby="buddy-name-hint" />
        <div id="buddy-name-hint" class="helper-text">This is how HeadyBuddy will greet you.</div>
      </div>

      <!-- Cognitive Archetype Selector -->
      <div class="form-group">
        <label class="form-label">Choose a Cognitive Archetype</label>
        <div class="archetype-grid" role="radiogroup" aria-label="Cognitive archetype selection">
          ${ARCHETYPES.map(a => `
            <div class="archetype-card ${a.id === this.#state.archetype ? 'selected' : ''}"
                 data-archetype="${a.id}"
                 role="radio"
                 aria-checked="${a.id === this.#state.archetype}"
                 tabindex="0"
                 aria-label="${a.name}: ${a.trait}">
              <span class="archetype-card-icon" aria-hidden="true">${a.icon}</span>
              <span class="archetype-card-name">${a.name}</span>
              <span class="archetype-card-trait">${a.trait}</span>
            </div>
          `).join('')}
        </div>
        <div class="archetype-description" id="archetype-desc" aria-live="polite">
          <div class="archetype-description-name" id="archetype-desc-name">${this.#getArchetype().icon} ${this.#getArchetype().name}</div>
          <div class="archetype-description-text" id="archetype-desc-text">${this.#getArchetype().description}</div>
        </div>
      </div>

      <!-- Interface Toggles -->
      <div class="form-group">
        <label class="form-label">Activate Interfaces</label>
        <div class="toggle-grid" role="group" aria-label="Interface toggles">
          ${INTERFACES.map(iface => `
            <div class="toggle-item ${this.#state.interfaces.has(iface.id) ? 'active' : ''}"
                 data-interface-id="${iface.id}"
                 role="switch"
                 aria-checked="${this.#state.interfaces.has(iface.id)}"
                 tabindex="0"
                 aria-label="Toggle ${iface.name}">
              <span class="toggle-item-icon" aria-hidden="true">${iface.icon}</span>
              <span class="toggle-item-label">${iface.name}</span>
              <span class="toggle-switch" aria-hidden="true"></span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- AI Provider Keys (collapsible) -->
      <div class="collapsible" id="ai-keys-section">
        <button type="button" class="collapsible-trigger" aria-expanded="false"
                aria-controls="ai-keys-body">
          <span>\uD83D\uDD11 AI Provider API Keys (optional)</span>
          <span class="collapsible-chevron" aria-hidden="true">\u25BC</span>
        </button>
        <div class="collapsible-body" id="ai-keys-body" role="region">
          <div class="collapsible-content">
            <p class="helper-text" style="margin-bottom: var(--space-md);">
              Add API keys to use your own accounts. HeadyBuddy works without these &mdash; Heady Cloud
              provides default models. Keys are encrypted with <strong>AES-256-GCM</strong>.
            </p>
            ${AI_KEY_FIELDS.map(field => `
              <div class="form-group" style="margin-bottom: var(--space-md);">
                <label class="form-label" for="ai-key-${field.id}">${field.name}</label>
                <div class="password-wrapper">
                  <input class="form-input" type="password" id="ai-key-${field.id}"
                         data-ai-key="${field.id}"
                         placeholder="${field.placeholder || 'Paste your API key'}"
                         autocomplete="off" spellcheck="false" />
                  <button type="button" class="password-toggle" aria-label="Toggle ${field.name} key visibility"
                          data-target="ai-key-${field.id}">\uD83D\uDC41</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Live Preview -->
      <div class="chat-preview" id="buddy-preview">
        <div class="chat-preview-label">Live Preview</div>
        <div class="chat-bubble">
          <div class="chat-bubble-sender">
            <span>${this.#getArchetype().icon}</span> HeadyBuddy <span style="opacity: 0.5; font-weight: 400;">(${this.#getArchetype().name})</span>
          </div>
          <span id="buddy-greeting"></span>
        </div>
      </div>
    `;
  }

  /* ---- Events ---- */

  #bindEvents() {
    /* Preferred name */
    const nameInput = this.#container.querySelector('#buddy-name');
    nameInput?.addEventListener('input', () => {
      this.#state.preferredName = nameInput.value.trim();
      this.#updatePreview();
      this.#notifyUpdate();
    });

    /* Archetype selection */
    this.#container.querySelectorAll('.archetype-card').forEach(card => {
      const handler = () => {
        this.#container.querySelectorAll('.archetype-card').forEach(c => {
          c.classList.remove('selected');
          c.setAttribute('aria-checked', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        this.#state.archetype = card.dataset.archetype;

        /* Update description */
        const arch = this.#getArchetype();
        const descName = this.#container.querySelector('#archetype-desc-name');
        const descText = this.#container.querySelector('#archetype-desc-text');
        if (descName) descName.textContent = `${arch.icon} ${arch.name}`;
        if (descText) descText.textContent = arch.description;

        /* Update preview sender */
        const sender = this.#container.querySelector('.chat-bubble-sender');
        if (sender) {
          sender.innerHTML = `<span>${arch.icon}</span> HeadyBuddy <span style="opacity: 0.5; font-weight: 400;">(${arch.name})</span>`;
        }

        this.#updatePreview();
        this.#notifyUpdate();
      };

      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    /* Interface toggles */
    this.#container.querySelectorAll('.toggle-item').forEach(item => {
      const handler = () => {
        const id = item.dataset.interfaceId;
        if (this.#state.interfaces.has(id)) {
          this.#state.interfaces.delete(id);
          item.classList.remove('active');
          item.setAttribute('aria-checked', 'false');
        } else {
          this.#state.interfaces.add(id);
          item.classList.add('active');
          item.setAttribute('aria-checked', 'true');
        }
        this.#updatePreview();
        this.#notifyUpdate();
      };
      item.addEventListener('click', handler);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    /* Collapsible AI keys */
    const trigger = this.#container.querySelector('.collapsible-trigger');
    trigger?.addEventListener('click', () => {
      const section = this.#container.querySelector('#ai-keys-section');
      const isOpen = section.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(isOpen));
    });

    /* Password toggles for API keys */
    this.#container.addEventListener('click', (e) => {
      const toggle = e.target.closest('.password-toggle');
      if (toggle) {
        const input = this.#container.querySelector(`#${toggle.dataset.target}`);
        if (input) {
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          toggle.textContent = isPassword ? '\uD83D\uDE48' : '\uD83D\uDC41';
        }
      }
    });

    /* AI key inputs */
    this.#container.querySelectorAll('[data-ai-key]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.aiKey;
        const val = input.value.trim();
        if (val) {
          this.#state.aiKeys[key] = val;
        } else {
          delete this.#state.aiKeys[key];
        }
        this.#notifyUpdate();
      });
    });
  }

  /* ---- Preview ---- */

  #updatePreview() {
    const el = this.#container.querySelector('#buddy-greeting');
    if (!el) return;

    const name = this.#state.preferredName || 'there';
    const arch = this.#getArchetype();
    const ifaceCount = this.#state.interfaces.size;

    const greetings = {
      OWL: `Greetings, ${name}. I've analyzed your setup \u2014 ${ifaceCount} interface${ifaceCount !== 1 ? 's' : ''} active. I'll provide structured, evidence-based guidance. What shall we investigate first?`,
      EAGLE: `Welcome aboard, ${name}! I see the big picture \u2014 ${ifaceCount} interface${ifaceCount !== 1 ? 's' : ''} ready. Let's set your strategic goals and build something impactful together.`,
      DOLPHIN: `Hey ${name}! \uD83C\uDF0A So excited to work together! You've got ${ifaceCount} interface${ifaceCount !== 1 ? 's' : ''} lit up. Let's brainstorm, create, and have fun \u2014 what's on your mind?`,
      RABBIT: `Hi ${name}! \u26A1 Ready to go \u2014 ${ifaceCount} interface${ifaceCount !== 1 ? 's' : ''} online. I'm built for speed. Give me a task and watch it happen. What's first?`,
      ANT: `Hello ${name}. ${ifaceCount} interface${ifaceCount !== 1 ? 's' : ''} initialized. Systems organized and ready for work. I'll track every detail and never drop a task. Where do we start?`,
      ELEPHANT: `Welcome, ${name}. I remember everything \u2014 and I'll carry your context across sessions. ${ifaceCount} interface${ifaceCount !== 1 ? 's' : ''} active. Let's build something that lasts.`,
      BEAVER: `Hey ${name}! \uD83D\uDD28 Workshop is ready \u2014 ${ifaceCount} interface${ifaceCount !== 1 ? 's' : ''} wired up. I'm here to build robust systems with you. What are we constructing?`,
    };

    el.textContent = greetings[this.#state.archetype] || greetings.OWL;
  }

  #notifyUpdate() {
    this.#onUpdate?.(this.getState());
  }

  /* ---- Helpers ---- */

  #getArchetype() {
    return ARCHETYPES.find(a => a.id === this.#state.archetype) || ARCHETYPES[0];
  }

  #escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  #escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
