// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ <heady-update-toast> — "new version ready" prompt         ║
// ║  Self-contained shadow-DOM web component. Colors are the dark     ║
// ║  canon from docs/design/design-tokens.json; motion is φ-timed     ║
// ║  (382ms = ψ²·1000, the V9 site transition) on the golden-section  ║
// ║  bezier. Emits "heady:reload" when the user accepts.              ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { PSI2, FIB } from "@heady/phi-math";

// design-tokens.json — color.dark + accent.sites.headyme + motion.easing.phi
const TOKEN = {
  bgSecondary: "#12121a",
  textPrimary: "#e8e8f0",
  textSecondary: "#9898a8",
  borderSubtle: "#ffffff14",
  accentHeadyme: "#00d4aa",
  bgPrimary: "#0a0a0f",
  easePhi: "cubic-bezier(0.618, 0, 0.382, 1)",
};

const SITE_MS = Math.round(PSI2 * 1000); // 382ms — motion.duration.site

export class HeadyUpdateToast extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          position: fixed;
          left: 50%;
          bottom: ${FIB[8]}px;
          transform: translateX(-50%) translateY(${FIB[10]}px);
          opacity: 0;
          z-index: 2147483000;
          transition: transform ${SITE_MS}ms ${TOKEN.easePhi}, opacity ${SITE_MS}ms ${TOKEN.easePhi};
          font-family: 'Inter', system-ui, sans-serif;
        }
        :host([visible]) {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          :host { transition: none; }
        }
        .toast {
          display: flex;
          align-items: center;
          gap: ${FIB[7]}px;
          padding: ${FIB[7]}px ${FIB[8]}px;
          background: ${TOKEN.bgSecondary};
          color: ${TOKEN.textPrimary};
          border: 1px solid ${TOKEN.borderSubtle};
          border-radius: ${FIB[6]}px;
          box-shadow: 0 ${FIB[5]}px ${FIB[8]}px #0a0a0fcc;
          font-size: 14px;
          line-height: 1.4;
          max-width: min(${FIB[14]}px, calc(100vw - ${FIB[8] * 2}px));
        }
        .msg { flex: 1; }
        .msg small { display: block; color: ${TOKEN.textSecondary}; font-size: 12px; }
        button {
          font: inherit;
          border-radius: ${FIB[5]}px;
          padding: ${FIB[5]}px ${FIB[7]}px;
          cursor: pointer;
          white-space: nowrap;
        }
        .reload {
          background: ${TOKEN.accentHeadyme};
          color: ${TOKEN.bgPrimary};
          border: 1px solid ${TOKEN.accentHeadyme};
          font-weight: 600;
        }
        .reload:hover { filter: brightness(1.13); }
        .later {
          background: transparent;
          color: ${TOKEN.textSecondary};
          border: 1px solid ${TOKEN.borderSubtle};
        }
        .later:hover { color: ${TOKEN.textPrimary}; }
      </style>
      <div class="toast" role="alertdialog" aria-live="polite" aria-label="Update available">
        <span class="msg">
          New version ready
          <small>Reload to get the latest HeadyMe Portal.</small>
        </span>
        <button class="later" type="button">Later</button>
        <button class="reload" type="button">Reload now</button>
      </div>`;

    root.querySelector(".reload").addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("heady:reload", { bubbles: true, composed: true }));
    });
    root.querySelector(".later").addEventListener("click", () => this.dismiss());
  }

  connectedCallback() {
    // Double-rAF so the entrance transition runs from the initial state.
    requestAnimationFrame(() => requestAnimationFrame(() => this.setAttribute("visible", "")));
  }

  dismiss() {
    this.removeAttribute("visible");
    setTimeout(() => this.remove(), SITE_MS);
  }
}

if (!customElements.get("heady-update-toast")) {
  customElements.define("heady-update-toast", HeadyUpdateToast);
}
