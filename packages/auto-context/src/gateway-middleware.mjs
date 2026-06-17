// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Auto-Context Gateway Middleware v2.0.0                    ║
// ║  The single runtime enforcement point for Unbreakable Law 4       ║
// ║  (Context Maximization) + Master Directive 1 (Omnipresent         ║
// ║  Contextual Awareness). It WRAPS a gateway so every reasoning     ║
// ║  entry is fed a CSL-ranked context capsule BEFORE it runs — no    ║
// ║  agent can opt out, because the gateway is the only door.         ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder · ⚠️ PATENT zone ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// WHY MIDDLEWARE, NOT A SKILL.  A skill is invoked at an agent's discretion; a wrapped gateway
// is structural — the capsule is attached on the request path itself, so "context-first" becomes
// a property of the system. This file defines the canonical CONTRACT the (Phase-3) gateway must
// satisfy; it works today against any object exposing complete/battle/council methods.
//
// THE 11 INTEGRATION POINTS (every place a reasoning call enters the ecosystem; each is enriched
// + narrated through this one wrapper, so the enforcement surface is auditable in one file):
//   1. gateway.complete        — the primary single-shot reasoning call (stage profile)
//   2. gateway.battle          — Arena/Battle candidate generation (battle profile)
//   3. gateway.council         — multi-model Council/Tribunal (council profile)
//   4. HCFullPipeline stage 00 CHANNEL_ENTRY — "auth + AutoContext" gate (enrichForStage)
//   5. HCFullPipeline stage 09 ARENA          — (enrichForBattle)
//   6. Directive 09 Council / consensus-tribunal — (enrichForCouncil)
//   7. HeadyBuddy device conversational turns — complete
//   8. codeflow /api/assign HeadyPerspective routing — complete
//   9. MCP tool-call planning (mcp-gateway) — complete
//  10. cron / autonomous-workflow reasoning ticks — complete
//  11. edge-gateway inference entry (Cloudflare Worker) — complete
// Points 4–11 are realized by routing their reasoning through the wrapped gateway from §1–3;
// this module is the chokepoint they all share.

import { ContextEnricher, ENRICH_PROFILES } from "./context-enrichment.mjs";
import { createNarrator } from "@heady/narrative";
import { createLogger } from "@heady/logger";
import { GATE, CSL_THRESHOLDS } from "@heady/phi-math";
import { ValidationError } from "@heady/shared";

const log = createLogger({ base: { component: "auto-context-middleware" } });

// Map each wrapped method to the enrichment profile it must use. The mapping IS the policy.
const METHOD_PROFILE = Object.freeze({
  complete: "stage",
  battle: "battle",
  council: "council",
});

/**
 * Derive the task signal an enricher needs from a gateway request. A request MUST already carry a
 * 384-dim `embedding` (the gateway embeds at the edge before routing — bge-small-en-v1.5). We do
 * NOT silently fabricate one: missing context is a Law-4 violation, surfaced loudly.
 */
function taskFromRequest(req) {
  if (!req || typeof req !== "object") throw new ValidationError("gateway request must be an object");
  const text = req.prompt ?? req.text ?? req.task ?? "";
  if (typeof text !== "string" || text.length === 0) {
    throw new ValidationError("auto-context: request has no prompt/text/task to enrich on");
  }
  if (!Array.isArray(req.embedding)) {
    throw new ValidationError("auto-context: request.embedding (384-dim) required before reasoning — Law 4");
  }
  return { text, embedding: req.embedding, traceId: req.traceId };
}

/**
 * Wrap a gateway so its reasoning methods are context-enriched + narrated. Returns a NEW object
 * delegating to the original; unknown methods pass straight through.
 *
 * @param {object} gateway   any object with some of { complete, battle, council }
 * @param {object} deps
 * @param {{retrieve:Function}} deps.retriever  live awareness retriever (injected — no globals)
 * @param {{publish:Function}}  [deps.bus]      @heady/events bus → narrative beats → HeadyLens
 * @param {string}              [deps.build]    human label for this run (rides every beat)
 * @param {number}              [deps.haltBelow] coherence floor; below it the call HALTs (default GATE.HALT = φ⁻²)
 * @returns {object} the wrapped gateway (same shape, enrichment enforced)
 */
export function wrapGateway(gateway, { retriever, bus, build = null, haltBelow = GATE.HALT } = {}) {
  if (!gateway || typeof gateway !== "object") throw new ValidationError("wrapGateway: gateway object required");
  const enricher = new ContextEnricher({ retriever });

  const wrapped = Object.create(gateway); // delegate everything not overridden

  for (const [method, profileName] of Object.entries(METHOD_PROFILE)) {
    if (typeof gateway[method] !== "function") continue; // only wrap what exists

    wrapped[method] = async function enrichedCall(req = {}, ...rest) {
      const task = taskFromRequest(req);
      // Per-call narrator threaded by the request's traceId so the UI groups the whole story.
      const narrator = bus ? createNarrator(bus, { traceId: task.traceId, build }) : null;
      const step = `gateway.${method}`;
      const l = log.child({ method, profile: profileName, traceId: task.traceId });

      await narrator?.start(step, `Enriching context for ${method} (${profileName} profile)`);
      const capsule = await enricher.enrich(task, profileName);

      // Coherence gate — a capsule below the halt floor means we'd be reasoning on noise.
      if (capsule.items.length > 0 && capsule.coherence < haltBelow) {
        l.warn({ coherence: capsule.coherence, haltBelow }, "context coherence below halt floor");
        await narrator?.gate(step, `Context coherence ${capsule.coherence} below floor ${haltBelow}`, {
          score: capsule.coherence, threshold: haltBelow, passed: false,
        });
        throw new ValidationError("auto-context: capsule coherence below halt floor — refusing to reason on noise", {
          coherence: capsule.coherence, haltBelow,
        });
      }

      await narrator?.gate(step, `Context capsule ready: ${capsule.items.length} items @ coherence ${capsule.coherence}`, {
        score: capsule.coherence, threshold: ENRICH_PROFILES[profileName].gate,
        items: capsule.items.length, considered: capsule.considered, deduped: capsule.deduped,
      });

      // Attach the capsule to the request — the gateway/model now reasons WITH live context.
      const enrichedReq = { ...req, autoContext: capsule };
      try {
        const result = await gateway[method](enrichedReq, ...rest);
        await narrator?.done(step, `${method} complete with ${capsule.items.length}-item context`);
        return result;
      } catch (err) {
        await narrator?.fail(step, `${method} failed`, err);
        throw err;
      }
    };
  }

  return wrapped;
}

/**
 * Assert a request was enriched (the capsule attached). HCFullPipeline stage 00 and the CI
 * enforcer use this to PROVE Law 4 held: an un-enriched request reaching a reasoning stage is a
 * governance violation, not a soft warning.
 */
export function assertEnriched(req) {
  if (!req || typeof req.autoContext !== "object" || !Array.isArray(req.autoContext.items)) {
    throw new ValidationError("Law 4 violation: request reached a reasoning stage without an auto-context capsule");
  }
  return req.autoContext;
}

export { CSL_THRESHOLDS, GATE };
