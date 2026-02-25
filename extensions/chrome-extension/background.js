/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * Heady Chrome Extension — Background Service Worker
 * Sets up context menus, keyboard shortcuts, and side panel.
 * Model-aware: routes to the correct Heady model per action.
 */

const HEADY_API = "https://manager.headysystems.com/api";

// Model mapping: each context menu action routes to the best model
const ACTION_MODELS = {
    "heady-ask": "heady-flash",
    "heady-explain": "heady-reason",
    "heady-code": "heady-flash",
    "heady-battle": "heady-battle-v1",
};

// ── Context Menus ──
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "heady-ask",
        title: "🐝 Ask Heady (Flash)",
        contexts: ["selection"],
    });
    chrome.contextMenus.create({
        id: "heady-explain",
        title: "🧠 Explain with Heady (Reason)",
        contexts: ["selection"],
    });
    chrome.contextMenus.create({
        id: "heady-code",
        title: "⚡ Refactor with Heady (Flash)",
        contexts: ["selection"],
    });
    chrome.contextMenus.create({
        id: "heady-battle",
        title: "🏆 Battle-validate with Heady (Arena)",
        contexts: ["selection"],
    });

    // Store default model
    chrome.storage.sync.set({ headyModel: 'heady-flash' });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const text = info.selectionText;
    if (!text) return;

    const prompts = {
        "heady-ask": text,
        "heady-explain": `[INTELLIGENCE] Explain the following in detail:\n\n${text}`,
        "heady-code": `[CODE TASK] Refactor and improve this code:\n\n${text}`,
        "heady-battle": `[BATTLE] Validate the following for regressions, security issues, and quality:\n\n${text}`,
    };

    const message = prompts[info.menuItemId] || text;
    const model = ACTION_MODELS[info.menuItemId] || 'heady-flash';

    // Open side panel and send the message with model info
    try {
        await chrome.sidePanel.open({ tabId: tab.id });
        setTimeout(() => {
            chrome.runtime.sendMessage({ type: "heady-query", message, model, source: info.menuItemId });
        }, 500);
    } catch (e) {
        chrome.action.openPopup();
    }
});

// ── Message Relay (now uses OpenAI-compatible endpoint) ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "heady-api") {
        const model = msg.model || 'heady-flash';

        // Get API key from storage
        chrome.storage.sync.get(['headyApiKey'], (result) => {
            const headers = { "Content-Type": "application/json" };
            if (result.headyApiKey) {
                headers["Authorization"] = `Bearer ${result.headyApiKey}`;
            }

            fetch(`${HEADY_API}/v1/chat/completions`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: msg.message }],
                }),
            })
                .then(r => r.json())
                .then(data => {
                    const reply = data.choices?.[0]?.message?.content || data.response || '';
                    sendResponse({ ok: true, data: { reply, model: data.model, heady: data.heady } });
                })
                .catch(err => sendResponse({ ok: false, error: err.message }));
        });
        return true; // async response
    }
});
