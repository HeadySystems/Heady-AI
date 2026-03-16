// packages/heady-conductor/langgraph-conductor.ts
// Extracted from langchain-ai/langgraph (MIT license)
// Maps Heady's coordination patterns to LangGraph StateGraph
//
// HEADY_BRAND:BEGIN
// © 2026 HeadySystems Inc. — LangGraph DAG Conductor
// HEADY_BRAND:END

/**
 * LangGraph StateGraph conductor for Heady's node orchestration.
 *
 * Provides a typed DAG execution model with:
 * - CSL-gated routing between HeadyBrain → HeadyBuddy → HeadyPatterns
 * - Redis checkpointing for human-in-the-loop pause/resume
 * - Conditional edges based on CSL resonance scores
 *
 * Dependencies:
 *   npm install @langchain/langgraph @langchain/core
 */

// ─── State Definition ───

export interface HeadyGraphState {
  messages: Array<{ role: string; content: string }>;
  userId: string;
  sessionId: string;
  cslScore: number;
  routedTo: string[];
  memoryContext: Record<string, unknown>;
  finalResponse: string;
}

export function createInitialState(
  userId: string,
  sessionId: string,
  userMessage: string
): HeadyGraphState {
  return {
    messages: [{ role: 'user', content: userMessage }],
    userId,
    sessionId,
    cslScore: 0,
    routedTo: [],
    memoryContext: {},
    finalResponse: '',
  };
}

// ─── Node Functions ───

/**
 * HeadyBrain node — preprocess + memory bootstrap.
 * Loads user memory, computes CSL score, injects context.
 */
export async function headyBrainNode(
  state: HeadyGraphState,
  deps: { fetchUserMemory: (userId: string) => Promise<Record<string, unknown>>;
          computeCSLScore: (content: string, memory: Record<string, unknown>) => number }
): Promise<Partial<HeadyGraphState>> {
  const lastMsg = state.messages[state.messages.length - 1];
  const memCtx = await deps.fetchUserMemory(state.userId);
  const cslScore = deps.computeCSLScore(lastMsg.content, memCtx);

  return {
    memoryContext: memCtx,
    cslScore,
    routedTo: [...state.routedTo, 'hc-brain'],
  };
}

/**
 * HeadyBuddy node — user-facing response generation.
 */
export async function headyBuddyNode(
  state: HeadyGraphState,
  deps: { generateResponse: (messages: any[], memory: any, csl: number) => Promise<string> }
): Promise<Partial<HeadyGraphState>> {
  const response = await deps.generateResponse(
    state.messages,
    state.memoryContext,
    state.cslScore
  );
  return {
    finalResponse: response,
    routedTo: [...state.routedTo, 'heady-buddy'],
  };
}

/**
 * HeadyPatterns node — background learning (non-blocking).
 * Writes interaction patterns to knowledge graph asynchronously.
 */
export async function headyPatternsNode(
  state: HeadyGraphState,
  deps: { writeToKnowledgeGraph: (userId: string, messages: any[], csl: number) => void }
): Promise<Partial<HeadyGraphState>> {
  // Fire and forget — async write to knowledge graph
  deps.writeToKnowledgeGraph(state.userId, state.messages, state.cslScore);
  return { routedTo: [...state.routedTo, 'heady-patterns'] };
}

// ─── Routing Function ───

const PHI_INV = 0.618033988749895; // 1/φ
const PHI_INV_SQ = 0.381966011250105; // 1/φ²

/**
 * CSL-gated routing decision after HeadyBrain preprocessing.
 */
export function routeAfterBrain(state: HeadyGraphState): 'buddy' | 'patterns_only' {
  if (state.cslScore < PHI_INV_SQ) return 'patterns_only'; // low signal — just learn
  return 'buddy'; // sufficient signal — respond
}

// ─── Graph Builder ───

/**
 * Build the HeadyConductor graph.
 *
 * Usage with LangGraph:
 * ```typescript
 * import { StateGraph, END, START } from "@langchain/langgraph";
 * import { Annotation } from "@langchain/langgraph";
 *
 * const HeadyState = Annotation.Root({ ... });
 * const graph = new StateGraph(HeadyState)
 *   .addNode("brain", headyBrainNode)
 *   .addNode("buddy", headyBuddyNode)
 *   .addNode("patterns", headyPatternsNode)
 *   .addEdge(START, "brain")
 *   .addConditionalEdges("brain", routeAfterBrain, {
 *     buddy: "buddy",
 *     patterns_only: "patterns",
 *   })
 *   .addEdge("buddy", "patterns")
 *   .addEdge("patterns", END);
 *
 * export const conductor = graph.compile({
 *   checkpointer: new RedisCheckpointer({ url: process.env.REDIS_URL })
 * });
 * ```
 */
export interface GraphDefinition {
  nodes: Array<{
    name: string;
    handler: (state: HeadyGraphState, deps: any) => Promise<Partial<HeadyGraphState>>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    condition?: (state: HeadyGraphState) => string;
  }>;
}

export function buildHeadyConductorGraph(): GraphDefinition {
  return {
    nodes: [
      { name: 'brain', handler: headyBrainNode },
      { name: 'buddy', handler: headyBuddyNode },
      { name: 'patterns', handler: headyPatternsNode },
    ],
    edges: [
      { from: 'START', to: 'brain' },
      { from: 'brain', to: 'buddy', condition: routeAfterBrain },
      { from: 'buddy', to: 'patterns' },
      { from: 'patterns', to: 'END' },
    ],
  };
}
