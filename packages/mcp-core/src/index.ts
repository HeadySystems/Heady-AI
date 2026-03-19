/**
 * @heady-ai/mcp-core — Shared Types for Heady MCP Services
 *
 * PRIVATE package — org members only (publishConfig.access: restricted)
 * Contains TypeScript types and interfaces shared between:
 *   - Public facade (@heady-ai/mcp-server)
 *   - Private backend (Cloud Run)
 *   - Internal services
 */

// ─── MCP Protocol Types ──────────────────────────────────────────

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: { content: MCPContent[] };
  error?: MCPError;
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// ─── Backend API Types ───────────────────────────────────────────

export interface BackendToolCallRequest {
  tool: string;
  arguments: Record<string, any>;
}

export interface BackendToolCallResponse {
  result: any;
  executedAt: string;
}

export interface BackendHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  platform: string;
  uptime: number;
  modules: Record<string, boolean>;
  timestamp: string;
}

// ─── Auth Types ──────────────────────────────────────────────────

export interface AuthValidation {
  valid: boolean;
  token?: string;
  error?: string;
  tier?: 'free' | 'pro' | 'enterprise';
}

// ─── Heady Domain Types ──────────────────────────────────────────

export interface HeadySearchResult {
  key: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
  namespace?: string;
  timestamp: string;
}

export interface HeadyPipelineResult {
  pipelineId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  task: string;
  stages: string[];
  results?: any[];
}

export interface HeadyBattleResult {
  battleId: string;
  status: 'queued' | 'running' | 'completed';
  prompt: string;
  models: string[];
  winner?: string;
  scores?: Record<string, number>;
}

export interface HeadySwarmDispatch {
  dispatchId: string;
  swarm: string;
  task: string;
  bees: number | 'auto';
  status: 'dispatched' | 'running' | 'completed';
}

// ─── Constants ───────────────────────────────────────────────────
// These are public — the proprietary implementations using them are private

export const MCP_VERSION = '5.0.0';
export const PROTOCOL_VERSION = '2024-11-05';
export const DEFAULT_API_URL = 'https://heady-mcp-backend-609590223909.us-east1.run.app';
