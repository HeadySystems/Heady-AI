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
// ║  FILE: extensions/chrome-extension/sidebar.js                    ║
// ║  LAYER: extensions                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/* ═══════════════════════════════════════════════════════════════════════
   HeadyBuddy Sidebar — Dynamic A2UI Renderer & Sacred Geometry Visualizer
   
   The sidebar UI is data-driven. Buddy sends JSON directives via the
   manager API and the renderer builds the UI dynamically.
   
   Features integrated:
     1. Modernized Promise-based storage & messaging.
     2. Interactive Sacred Geometry HTML5 Canvas (Torus/Flower of Life math).
     3. State-of-the-art Glassmorphism layout mode toggling.
     4. Fully functional API setting drawers with live memory storage.
   ═══════════════════════════════════════════════════════════════════════ */

const API_BASE_DEFAULT = "https://headyapi.com";
const BUDDY_AVATAR = "icons/buddy-avatar.png";
const BUDDY_THINKING_IMG = "icons/buddy-thinking.png";
const BUDDY_COMPLETE_IMG = "icons/buddy-complete.png";

// Dom Elements
const $feed = document.getElementById("buddy-feed");
const $content = document.getElementById("dynamic-content");
const $welcome = document.getElementById("welcome");
const $input = document.getElementById("buddy-input");
const $sendBtn = document.getElementById("send-btn");

const $settingsToggle = document.getElementById("settings-toggle");
const $settingsPanel = document.getElementById("settings-panel");
const $toggleGlass = document.getElementById("toggle-glass");
const $toggleCanvas = document.getElementById("toggle-canvas");
const $apiBaseInput = document.getElementById("api-base-input");
const $apiKeyInput = document.getElementById("api-key-input");
const $visualizerWrap = document.getElementById("visualizer-wrap");
const $canvas = document.getElementById("canvas-visualizer");

// Active System State for Sacred Geometry Visualizer
let systemState = "active"; // "active" | "thinking" | "idle" | "error"
let currentSpeed = 0.015;
let targetSpeed = 0.015;
let currentScale = 1.0;
let targetScale = 1.0;
let breathAngle = 0;
let rotationAngle = 0;
let liveLatency = -1;
let lastInteractionTs = Date.now();
let animationFrameId = null;

// Mouse reaction positions
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;
let isHovered = false;

/* ─── A2UI RENDERER ────────────────────────────────────────────────── */
const A2UI = {
    /**
     * Render an array of A2UI blocks into the dynamic content zone.
     * Can be called multiple times — appends or replaces based on mode.
     */
    render(blocks, { append = true, hideWelcome = true } = {}) {
        if (hideWelcome) $welcome.style.display = "none";
        if (!append) $content.innerHTML = "";

        blocks.forEach((block) => {
            const el = this._createBlock(block);
            if (el) $content.appendChild(el);
        });

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            $feed.scrollTop = $feed.scrollHeight;
        });
    },

    /** Clear all dynamic content and show welcome */
    clear() {
        $content.innerHTML = "";
        $welcome.style.display = "flex";
    },

    /** Create a single A2UI block element */
    _createBlock(block) {
        switch (block.type) {
            case "text": return this._text(block);
            case "image": return this._image(block);
            case "code": return this._code(block);
            case "heading": return this._heading(block);
            case "list": return this._list(block);
            case "status": {
                // Update systemState to match the status block
                if (block.state) updateSystemState(block.state);
                return this._status(block);
            }
            case "divider": return this._divider();
            case "thinking": {
                updateSystemState("thinking");
                return this._thinking(block);
            }
            case "card": return this._card(block);
            default: return null;
        }
    },

    /* ─── Block Builders ───────────────────────────────────────────── */

    _text(b) {
        const wrap = document.createElement("div");
        wrap.className = "buddy-message";
        wrap.innerHTML = `
            <img src="${BUDDY_AVATAR}" alt="" class="buddy-avatar-sm">
            <div class="buddy-content">
                ${b.label ? `<div class="buddy-label">${esc(b.label)}</div>` : ""}
                <div class="buddy-text">${prettyPrint(b.content || "")}</div>
                ${b.timestamp ? `<div class="buddy-timestamp">${timeAgo(b.timestamp)}</div>` : ""}
            </div>
        `;
        return wrap;
    },

    _image(b) {
        const card = document.createElement("div");
        card.className = "buddy-image-card";
        const src = resolveImage(b.src || b.url || "");
        card.innerHTML = `
            <img src="${src}" alt="${esc(b.alt || "")}" loading="lazy">
            ${b.caption ? `<div class="buddy-image-caption">${esc(b.caption)}</div>` : ""}
        `;
        return card;
    },

    _code(b) {
        const block = document.createElement("div");
        block.className = "buddy-code-block";
        block.innerHTML = `
            <div class="buddy-code-header">
                <span class="buddy-code-lang">${esc(b.language || "output")}</span>
                <button class="buddy-code-copy" data-code="${esc(b.content || "")}">Copy</button>
            </div>
            <pre class="buddy-code-content">${esc(b.content || "")}</pre>
        `;
        block.querySelector(".buddy-code-copy").addEventListener("click", (e) => {
            navigator.clipboard.writeText(b.content || "");
            e.target.textContent = "Copied!";
            setTimeout(() => (e.target.textContent = "Copy"), 1500);
        });
        return block;
    },

    _heading(b) {
        const h = document.createElement("h3");
        h.className = "buddy-heading";
        h.textContent = b.content || "";
        return h;
    },

    _list(b) {
        const ul = document.createElement("ul");
        ul.className = "buddy-list";
        (b.items || []).forEach((item) => {
            const li = document.createElement("li");
            li.innerHTML = prettyPrint(item);
            ul.appendChild(li);
        });
        return ul;
    },

    _status(b) {
        const div = document.createElement("div");
        div.className = "buddy-status-card";
        const state = b.state || "active";
        div.innerHTML = `
            <div class="buddy-status-dot buddy-status-dot--${state}"></div>
            <span class="buddy-status-text">${esc(b.content || "Processing…")}</span>
        `;
        return div;
    },

    _divider() {
        return Object.assign(document.createElement("hr"), { className: "buddy-divider" });
    },

    _thinking(b) {
        const div = document.createElement("div");
        div.className = "thinking-indicator";
        div.innerHTML = `
            <img src="${BUDDY_THINKING_IMG}" alt="" class="thinking-image">
            <span class="thinking-text">${esc(b.content || "Buddy is thinking…")}</span>
        `;
        return div;
    },

    _card(b) {
        const card = document.createElement("div");
        card.className = "buddy-content";
        card.style.animation = "fadeUp 0.4s var(--ease)";
        card.innerHTML = `
            ${b.title ? `<div class="buddy-label">${esc(b.title)}</div>` : ""}
            <div class="buddy-text">${prettyPrint(b.content || "")}</div>
        `;
        return card;
    },
};

/* ─── PRETTY PRINT ─────────────────────────────────────────────────── */
function prettyPrint(text) {
    return text
        // Bold: **text** → <strong>
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // Italic: *text* → <em>
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
        // Inline code: `text` → <code>
        .replace(/`(.+?)`/g, '<code style="background:rgba(0,230,180,0.08);padding:1px 5px;border-radius:3px;font-family:var(--font-mono);font-size:12px;color:var(--text-code)">$1</code>')
        // Links: [text](url)
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Line breaks
        .replace(/\n/g, "<br>");
}

function esc(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function timeAgo(ts) {
    const diff = Date.now() - (typeof ts === "number" ? ts : new Date(ts).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
}

/** Map branded keywords to local images */
function resolveImage(src) {
    const map = {
        "buddy-avatar": BUDDY_AVATAR,
        "buddy-thinking": BUDDY_THINKING_IMG,
        "buddy-complete": BUDDY_COMPLETE_IMG,
        "avatar": BUDDY_AVATAR,
        "thinking": BUDDY_THINKING_IMG,
        "complete": BUDDY_COMPLETE_IMG,
        "success": BUDDY_COMPLETE_IMG,
    };
    return map[src] || src;
}

/* ─── SACRED GEOMETRY CANVAS ANIMATION LOOP ───────────────────────── */
const PHI = 1.61803398875;
const INV_PHI = 0.61803398875;

function initCanvas() {
    if (!$canvas) return;
    const ctx = $canvas.getContext("2d");

    // Dynamic sizing helper
    function resize() {
        const rect = $canvas.getBoundingClientRect();
        // Use devicePixelRatio for super crisp lines on high-DPI displays
        const dpr = window.devicePixelRatio || 1;
        $canvas.width = rect.width * dpr;
        $canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    }

    window.addEventListener("resize", resize);
    resize();

    // Mouse interactive capture
    $canvas.addEventListener("mousemove", (e) => {
        const rect = $canvas.getBoundingClientRect();
        targetMouseX = e.clientX - rect.left;
        targetMouseY = e.clientY - rect.top;
        isHovered = true;
        lastInteractionTs = Date.now();
    });

    $canvas.addEventListener("mouseleave", () => {
        isHovered = false;
    });

    // Main Sacred Geometry Loop
    function draw() {
        if ($toggleCanvas && !$toggleCanvas.checked) {
            animationFrameId = requestAnimationFrame(draw);
            return;
        }

        const width = $canvas.width / (window.devicePixelRatio || 1);
        const height = $canvas.height / (window.devicePixelRatio || 1);

        ctx.clearRect(0, 0, width, height);

        // State machine interpolators
        if (systemState === "thinking") {
            targetSpeed = 0.045;
            targetScale = 1.12;
        } else if (systemState === "error") {
            targetSpeed = 0.005;
            targetScale = 0.95;
        } else if (systemState === "idle") {
            targetSpeed = 0.008;
            targetScale = 0.98;
        } else {
            // default active
            targetSpeed = 0.016;
            targetScale = 1.0;
        }

        // Smoothly interpolate parameters
        currentSpeed += (targetSpeed - currentSpeed) * 0.1;
        currentScale += (targetScale - currentScale) * 0.1;
        
        // Mouse gravity well easing
        if (isHovered) {
            mouseX += (targetMouseX - mouseX) * 0.08;
            mouseY += (targetMouseY - mouseY) * 0.08;
        } else {
            // Ease back to center
            mouseX += (width / 2 - mouseX) * 0.05;
            mouseY += (height / 2 - mouseY) * 0.05;
        }

        rotationAngle += currentSpeed;
        breathAngle += 0.02;

        const centerX = mouseX;
        const centerY = mouseY;

        // Dynamic base radius styled around Golden Section ratios
        const breathingFactor = 1 + Math.sin(breathAngle) * 0.06 * (systemState === "thinking" ? 1.5 : 1.0);
        const baseRadius = (height * 0.32) * currentScale * breathingFactor;

        // Apply global styles
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalCompositeOperation = "screen";

        // Color profiles matching thinking / active / error
        let strokeColor1, strokeColor2, glowColor;
        if (systemState === "thinking") {
            // Pulsing golden amber and indigo purple
            strokeColor1 = `hsla(38, 92%, 50%, 0.45)`;
            strokeColor2 = `hsla(258, 90%, 75%, 0.45)`;
            glowColor = "rgba(167, 139, 250, 0.25)";
        } else if (systemState === "error") {
            // Subdued warning crimson
            strokeColor1 = `hsla(343, 85%, 55%, 0.4)`;
            strokeColor2 = `hsla(20, 80%, 50%, 0.35)`;
            glowColor = "rgba(251, 113, 133, 0.15)";
        } else if (systemState === "idle") {
            // Muted low-frequency teal/dim steel
            strokeColor1 = `hsla(167, 50%, 40%, 0.25)`;
            strokeColor2 = `hsla(210, 40%, 30%, 0.2)`;
            glowColor = "rgba(0, 230, 180, 0.05)";
        } else {
            // Live active: Heady mint-teal and glowing cyan
            strokeColor1 = `hsla(167, 100%, 45%, 0.4)`;
            strokeColor2 = `hsla(180, 100%, 45%, 0.35)`;
            glowColor = "rgba(0, 255, 204, 0.2)";
        }

        // Draw radial aura background
        const aura = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius * 1.618);
        aura.addColorStop(0, glowColor);
        aura.addColorStop(1, "transparent");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 1.618, 0, Math.PI * 2);
        ctx.fill();

        // 1. Torus Inner Geometry Grid: Intersecting Phi Circles (Flower of Life topology)
        const circlesCount = 12;
        for (let i = 0; i < circlesCount; i++) {
            const angle = (i * Math.PI * 2) / circlesCount + rotationAngle;
            
            // Core coordinate calculation adhering to golden Section
            const rOffset = baseRadius * INV_PHI * 0.8;
            const x = centerX + Math.cos(angle) * rOffset;
            const y = centerY + Math.sin(angle) * rOffset;

            ctx.beginPath();
            ctx.arc(x, y, baseRadius * INV_PHI, 0, Math.PI * 2);
            ctx.strokeStyle = strokeColor1;
            ctx.lineWidth = 1.0;
            ctx.stroke();
        }

        // 2. Star Polygon Connection Mesh (Swarms node grid)
        const outerPoints = 8;
        const outerNodes = [];
        ctx.beginPath();
        for (let i = 0; i < outerPoints; i++) {
            const angle = (i * Math.PI * 2) / outerPoints - rotationAngle * 0.5;
            const radius = baseRadius * PHI * 0.8;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            outerNodes.push({ x, y });

            // Small pulsing node dots representing agents
            ctx.fillStyle = i === 0 ? "var(--accent-bright)" : strokeColor1;
            ctx.beginPath();
            ctx.arc(x, y, i === 0 ? 3.5 : 2.0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Inter-connect nodes with golden ratios chords
        ctx.beginPath();
        for (let i = 0; i < outerPoints; i++) {
            for (let j = i + 1; j < outerPoints; j++) {
                // Connect alternating points to form beautiful geometric webs
                if ((j - i) % 2 === 1 || (j - i) === 3) {
                    ctx.moveTo(outerNodes[i].x, outerNodes[i].y);
                    ctx.lineTo(outerNodes[j].x, outerNodes[j].y);
                }
            }
        }
        ctx.strokeStyle = strokeColor2;
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // 3. Central Nucleus Core
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * INV_PHI * INV_PHI, 0, Math.PI * 2);
        ctx.strokeStyle = strokeColor1;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Smallest inner binary balance dot
        ctx.fillStyle = systemState === "thinking" ? "var(--amber)" : "var(--accent)";
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3 + Math.sin(breathAngle * 2) * 1, 0, Math.PI * 2);
        ctx.fill();

        // Draw latency meter if verified
        if (liveLatency > 0 && isHovered) {
            ctx.fillStyle = "var(--text-secondary)";
            ctx.font = "500 10px var(--font-mono)";
            ctx.textAlign = "center";
            ctx.fillText(`${liveLatency}ms`, centerX, centerY - baseRadius - 15);
        }

        animationFrameId = requestAnimationFrame(draw);
    }

    mouseX = width / 2;
    mouseY = height / 2;
    draw();
}

function updateSystemState(newState) {
    systemState = newState;
}

/* ─── DYNAMIC SETTINGS MECHANICS ────────────────────────────────────── */
async function loadVisualSettings() {
    try {
        const items = await chrome.storage.local.get(["glassMode", "canvasMode", "apiBase", "apiKey"]);
        
        // 1. Glassmorphism theme setup
        const isGlass = items.glassMode !== false; // default true
        $toggleGlass.checked = isGlass;
        if (isGlass) {
            document.body.classList.add("glass-mode");
        } else {
            document.body.classList.remove("glass-mode");
        }

        // 2. Sacred Geometry setup
        const isCanvas = items.canvasMode !== false; // default true
        $toggleCanvas.checked = isCanvas;
        if (isCanvas) {
            $visualizerWrap.classList.remove("collapsed");
        } else {
            $visualizerWrap.classList.add("collapsed");
        }

        // 3. Custom settings drawer values
        $apiBaseInput.value = items.apiBase || API_BASE_DEFAULT;
        $apiKeyInput.value = items.apiKey || "";

    } catch (err) {
        console.error("Failed to load visual configurations", err);
    }
}

// Bind visual toggles listeners
$settingsToggle.addEventListener("click", () => {
    $settingsPanel.classList.toggle("open");
});

$toggleGlass.addEventListener("change", async (e) => {
    const active = e.target.checked;
    await chrome.storage.local.set({ glassMode: active });
    if (active) {
        document.body.classList.add("glass-mode");
    } else {
        document.body.classList.remove("glass-mode");
    }
});

$toggleCanvas.addEventListener("change", async (e) => {
    const active = e.target.checked;
    await chrome.storage.local.set({ canvasMode: active });
    if (active) {
        $visualizerWrap.classList.remove("collapsed");
    } else {
        $visualizerWrap.classList.add("collapsed");
    }
});

$apiBaseInput.addEventListener("input", async (e) => {
    await chrome.storage.local.set({ apiBase: e.target.value.trim() });
});

$apiKeyInput.addEventListener("input", async (e) => {
    await chrome.storage.local.set({ apiKey: e.target.value.trim() });
});

/* ─── PROMISE-BASED USER INPUT SCRIPTING ────────────────────────────── */
async function handleSend() {
    const text = $input.value.trim();
    if (!text) return;
    $input.value = "";

    // Show user message & switch state to thinking
    A2UI.render([
        { type: "text", label: "You", content: text, timestamp: Date.now() },
        { type: "thinking", content: "Buddy is on it…" },
    ]);
    updateSystemState("thinking");

    const startTime = Date.now();

    try {
        const items = await chrome.storage.local.get(["apiKey", "apiBase"]);
        const apiBase = items.apiBase || API_BASE_DEFAULT;
        const apiKey = items.apiKey || "";

        // Promise messaging
        const response = await chrome.runtime.sendMessage({
            action: "fetchChat",
            apiBase,
            apiKey,
            message: text,
            model: "heady-buddy"
        });

        // Compute response speed latency
        liveLatency = Date.now() - startTime;

        // Clear thinking indicators
        const thinkingEls = $content.querySelectorAll(".thinking-indicator");
        thinkingEls.forEach((el) => el.remove());

        if (response?.ok && response.data) {
            updateSystemState("active");
            A2UI.render([
                {
                    type: "text",
                    label: "Buddy",
                    content: response.data.content,
                    timestamp: Date.now(),
                },
            ]);
        } else {
            // Try fallback
            const fallbackResponse = await chrome.runtime.sendMessage({
                action: "fetchBuddy",
                apiBase,
                apiKey
            });

            if (fallbackResponse?.ok && fallbackResponse.data) {
                updateSystemState("active");
                const health = fallbackResponse.data;
                A2UI.render([
                    {
                        type: "text",
                        label: "Buddy",
                        content: `I heard you! The chat endpoint isn't responding right now, but I can confirm the system is **${health.status || "online"}**. Uptime: \`${formatUptime(health.uptime || health.uptimeMs)}\`. ${health.version ? `Running v${health.version}.` : ""} Try again in a moment — the AI models may be warming up.`,
                        timestamp: Date.now(),
                    },
                ]);
            } else {
                throw new Error("No response from endpoint");
            }
        }
    } catch (err) {
        updateSystemState("error");
        const thinkingEls = $content.querySelectorAll(".thinking-indicator");
        thinkingEls.forEach((el) => el.remove());

        A2UI.render([
            {
                type: "text",
                label: "Buddy",
                content: "I'm having trouble reaching the Heady™ network right now. Check your connection or API key, then try again.",
                timestamp: Date.now(),
            },
        ]);
    }
}

$sendBtn.addEventListener("click", handleSend);
$input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

function formatUptime(ms) {
    if (!ms || ms <= 0) return "calculating…";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

/* ─── INITIAL LOAD — Fetch Buddy's latest output ──────────────────── */
async function loadBuddyOutput() {
    try {
        const items = await chrome.storage.local.get(["apiBase"]);
        const apiBase = items.apiBase || API_BASE_DEFAULT;

        const response = await chrome.runtime.sendMessage({
            action: "fetchA2UI",
            apiBase
        });

        if (response?.ok && response.data?.blocks) {
            A2UI.render(response.data.blocks, { append: false });
        }
    } catch {
        // Welcome screen stays visible
    }
}

/* ─── INITIALIZATION STARTUP ───────────────────────────────────────── */
async function bootstrap() {
    await loadVisualSettings();
    initCanvas();
    await loadBuddyOutput();
}

bootstrap();

/* ─── EXPOSE A2UI GLOBALLY for Buddy to call from content scripts ──── */
window.A2UI = A2UI;

/* ─── LISTEN FOR DYNAMIC UPDATES from background/content scripts ───── */
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "a2ui:render") {
        A2UI.render(msg.blocks || [], { append: msg.append !== false });
    }
    if (msg.action === "a2ui:clear") {
        A2UI.clear();
    }
});
