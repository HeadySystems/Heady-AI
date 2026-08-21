// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Nodes Admin Presentation Logic v1.0.0                   ║
// ║  Pure state shaping for truthful orchestration administration.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

const ACTION_PATTERN = /^[a-z][a-z0-9._-]*$/;

export function readinessTone(readiness) {
  if (readiness?.productionReady === true) return "online";
  if (readiness?.dispatchAccepting === true) return "alert";
  return "offline";
}

export function groupNodes(nodes = []) {
  return nodes.reduce((groups, node) => {
    const group = node.group || "Unclassified";
    groups[group] ??= [];
    groups[group].push(node);
    return groups;
  }, {});
}

export function validateDispatch({ nodeId, action, inputText }) {
  if (!nodeId) throw new TypeError("Select a runtime node");
  const normalizedAction = String(action ?? "").trim();
  if (!ACTION_PATTERN.test(normalizedAction)) {
    throw new TypeError("Action must start with a letter and contain only lowercase letters, numbers, dots, underscores, or hyphens");
  }
  let input;
  try {
    input = inputText?.trim() ? JSON.parse(inputText) : {};
  } catch {
    throw new TypeError("Input must be valid JSON");
  }
  if (!input || Array.isArray(input) || typeof input !== "object") {
    throw new TypeError("Input must be a JSON object");
  }
  return { nodeId, body: { action: normalizedAction, input, dependsOn: [] } };
}

export function auditDelivery(event) {
  return event?.dispatched_at ? "projected" : "pending";
}
