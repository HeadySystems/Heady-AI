// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Portal SW Registration + Auto-Update Flow                 ║
// ║  register → detect waiting worker → dispatch                      ║
// ║  "heady:sw-update-ready" → <heady-update-toast> → user accepts →  ║
// ║  postMessage HEADY_SKIP_WAITING → controllerchange → one reload.  ║
// ║  Update polling rides the golden heartbeat (φ⁷s) scaled by        ║
// ║  FIB[10] (~26.6 min) plus a check whenever the tab regains focus. ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { HEARTBEAT_MS, FIB } from "@heady/phi-math";
import "./update-toast.js";

const UPDATE_POLL_MS = HEARTBEAT_MS * FIB[10]; // 29034ms × 55 ≈ 26.6 min
let toastShown = false;
let reloading = false;

function promptUpdate(registration) {
  const waiting = registration.waiting;
  if (!waiting || toastShown) return;
  toastShown = true;

  window.dispatchEvent(
    new CustomEvent("heady:sw-update-ready", { detail: { version: __HEADY_VERSION__ } })
  );
  console.info(JSON.stringify({ evt: "heady.pwa.update_ready", app_version: __HEADY_VERSION__ }));

  const toast = document.createElement("heady-update-toast");
  toast.addEventListener("heady:reload", () => {
    // Activation handshake: the waiting worker calls skipWaiting(), the
    // controllerchange listener below performs the single page reload.
    waiting.postMessage({ type: "HEADY_SKIP_WAITING" });
    toast.dismiss();
  });
  document.body.appendChild(toast);
}

function watchRegistration(registration) {
  // A worker may already be parked in waiting (deploy happened tabs ago).
  if (registration.waiting && navigator.serviceWorker.controller) {
    promptUpdate(registration);
  }

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // "installed" with an existing controller = a NEW version is waiting.
      // (First-ever install has no controller — nothing to prompt about.)
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        promptUpdate(registration);
      }
    });
  });

  const poll = () => {
    registration.update().catch((err) => {
      console.info(JSON.stringify({ evt: "heady.pwa.update_check_failed", message: err.message }));
    });
  };
  setInterval(poll, UPDATE_POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poll();
  });
}

export function initPwa() {
  if (!("serviceWorker" in navigator)) {
    console.info(JSON.stringify({ evt: "heady.pwa.skip", reason: "no-serviceworker-api" }));
    return;
  }
  // Dev serves source modules with no stamped SW — registration is
  // production-build-only so it never fights Vite HMR.
  if (!import.meta.env.PROD) {
    console.info(JSON.stringify({ evt: "heady.pwa.skip", reason: "dev-mode" }));
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.info(
          JSON.stringify({ evt: "heady.pwa.registered", scope: registration.scope, app_version: __HEADY_VERSION__ })
        );
        watchRegistration(registration);
      })
      .catch((err) => {
        console.error(JSON.stringify({ evt: "heady.pwa.register_failed", message: err.message }));
      });
  });
}
