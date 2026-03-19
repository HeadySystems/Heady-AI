/**
 * Heady MCP — Tool Schema Definitions
 * Pure data — all inputSchema/description for the 45+ MCP tools.
 * Separated from business logic for clean orchestration.
 */

module.exports = [
  // ── Status & Brain ──────────────────────────────────
  { name: 'heady_status', description: 'Get overall Heady system status — checks project structure, configs, and services', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_list_services', description: 'List all services defined in the Heady service catalog', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_pipeline_status', description: 'Get HCFullPipeline configuration and stage definitions', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_brain_status', description: 'Get System Brain overview — ORS score, active patterns, recommendations, subsystem health', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_brain_think', description: 'Ask the System Brain to analyze a situation and recommend actions', inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'What should the brain analyze?' }, context: { type: 'object', description: 'Optional context data' } }, required: ['question'] } },
  { name: 'heady_patterns_list', description: 'List all implemented, planned, and available patterns from concepts-index', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_patterns_evaluate', description: 'Evaluate a pattern for potential adoption — benefits, risks, dependencies', inputSchema: { type: 'object', properties: { patternId: { type: 'string', description: 'Pattern name or ID to evaluate' } }, required: ['patternId'] } },
  { name: 'heady_registry_list', description: 'List all components in heady-registry.json — services, docs, notebooks, workflows, AI nodes', inputSchema: { type: 'object', properties: { category: { type: 'string', description: 'Filter by category' } } } },
  { name: 'heady_registry_lookup', description: 'Look up a specific component in the registry by name or ID', inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Component name or ID' } }, required: ['name'] } },

  // ── File System ─────────────────────────────────────
  { name: 'heady_read_config', description: 'Read a Heady YAML or JSON config file from the configs/ directory', inputSchema: { type: 'object', properties: { filename: { type: 'string', description: 'Config filename (e.g., "service-catalog.yaml")' } }, required: ['filename'] } },
  { name: 'heady_list_configs', description: 'List all available configuration files in the Heady configs/ directory', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_project_tree', description: 'Show the top-level directory structure of the Heady project', inputSchema: { type: 'object', properties: { subdir: { type: 'string', description: 'Optional subdirectory to list' } } } },
  { name: 'heady_read_file', description: 'Read a file from the Heady project directory', inputSchema: { type: 'object', properties: { filepath: { type: 'string', description: 'Relative path from Heady root' }, maxLines: { type: 'number', description: 'Maximum lines to return (default: 200)', default: 200 } }, required: ['filepath'] } },
  { name: 'heady_search', description: 'Search for text patterns across the Heady project files', inputSchema: { type: 'object', properties: { pattern: { type: 'string', description: 'Text or regex pattern to search for' }, fileTypes: { type: 'string', description: 'File extensions to search (e.g., "js,yaml,json")' } }, required: ['pattern'] } },
  { name: 'heady_write_file', description: 'Write content to a file in the Heady project (requires CodeLock approval if locked)', inputSchema: { type: 'object', properties: { filepath: { type: 'string', description: 'Relative path from Heady root' }, content: { type: 'string', description: 'File content to write' }, changeId: { type: 'string', description: 'Approved change request ID' } }, required: ['filepath', 'content'] } },

  // ── Deploy ──────────────────────────────────────────
  { name: 'heady_deploy_status', description: 'Get auto-deploy system status — scheduler, git state, recent deploys', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_deploy_run', description: 'Trigger a single auto-deploy cycle (commit, push, deploy)', inputSchema: { type: 'object', properties: { message: { type: 'string', description: 'Custom commit message' }, force: { type: 'boolean', description: 'Force deploy' } } } },
  { name: 'heady_deploy_start', description: 'Start the auto-deploy scheduler', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_deploy_stop', description: 'Stop the auto-deploy scheduler', inputSchema: { type: 'object', properties: {} } },

  // ── Translator ──────────────────────────────────────
  { name: 'heady_translator_status', description: 'Get HeadyTranslator status — adapters, routes, stats, protocol bridge health', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_translator_translate', description: 'Translate a message between protocols (MCP, HTTP, WebSocket, UDP, MIDI, TCP)', inputSchema: { type: 'object', properties: { sourceProtocol: { type: 'string' }, targetProtocol: { type: 'string' }, operation: { type: 'string' }, payload: { type: 'object' }, targetEndpoint: { type: 'string' } }, required: ['sourceProtocol', 'targetProtocol', 'operation'] } },
  { name: 'heady_translator_adapters', description: 'List all registered protocol adapters and their capabilities', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_translator_decode', description: 'Decode raw protocol data into a canonical HeadyMessage envelope', inputSchema: { type: 'object', properties: { protocol: { type: 'string' }, data: { type: 'string' } }, required: ['protocol', 'data'] } },
  { name: 'heady_translator_bridge', description: 'Start or stop the HTTP bridge server for external protocol translation', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'stop'] }, port: { type: 'number' } }, required: ['action'] } },

  // ── CodeLock ─────────────────────────────────────────
  { name: 'heady_codelock_status', description: 'Get codebase lock status — who can make changes, pending approvals, audit trail', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_codelock_lock', description: 'Lock the codebase — blocks all changes until owner approves', inputSchema: { type: 'object', properties: { reason: { type: 'string' } } } },
  { name: 'heady_codelock_unlock', description: 'Unlock the codebase (owner only)', inputSchema: { type: 'object', properties: { reason: { type: 'string' } } } },
  { name: 'heady_codelock_request', description: 'Request approval to change specific files', inputSchema: { type: 'object', properties: { id: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, description: { type: 'string' } }, required: ['id', 'files', 'description'] } },
  { name: 'heady_codelock_approve', description: 'Approve a pending change request (owner only)', inputSchema: { type: 'object', properties: { changeId: { type: 'string' } }, required: ['changeId'] } },
  { name: 'heady_codelock_deny', description: 'Deny a pending change request (owner only)', inputSchema: { type: 'object', properties: { changeId: { type: 'string' }, reason: { type: 'string' } }, required: ['changeId'] } },
  { name: 'heady_codelock_snapshot', description: 'Take a file integrity snapshot', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_codelock_detect', description: 'Detect unauthorized changes since last snapshot', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_codelock_audit', description: 'View the codelock audit trail', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'heady_codelock_users', description: 'Add or remove users allowed to approve changes', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['add', 'remove'] }, username: { type: 'string' } }, required: ['action', 'username'] } },

  // ── Latent Space ────────────────────────────────────
  { name: 'heady_latent_record', description: 'Record an operation in Heady latent space (vector memory)', inputSchema: { type: 'object', properties: { category: { type: 'string' }, text: { type: 'string' }, meta: { type: 'object' } }, required: ['category', 'text'] } },
  { name: 'heady_latent_search', description: 'Search latent space by semantic similarity', inputSchema: { type: 'object', properties: { query: { type: 'string' }, topK: { type: 'number' }, category: { type: 'string' } }, required: ['query'] } },
  { name: 'heady_latent_status', description: 'Get latent space status — ring buffer, vector store, operations log stats', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_latent_log', description: 'View recent operations log from latent space', inputSchema: { type: 'object', properties: { category: { type: 'string' }, limit: { type: 'number' } } } },

  // ── Git & Conflicts ─────────────────────────────────
  { name: 'heady_git_log', description: 'View recent git commits and branch info', inputSchema: { type: 'object', properties: { limit: { type: 'number' } } } },
  { name: 'heady_git_diff', description: 'Show git diff — unstaged changes or diff between branches', inputSchema: { type: 'object', properties: { target: { type: 'string' }, filepath: { type: 'string' } } } },
  { name: 'heady_git_status', description: 'Show git status — modified, staged, untracked files', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_conflicts_scan', description: 'Scan all project files for git merge conflicts', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_conflicts_resolve', description: 'Auto-resolve merge conflicts in a file by keeping one side', inputSchema: { type: 'object', properties: { filepath: { type: 'string' }, strategy: { type: 'string', enum: ['ours', 'theirs', 'both'] } }, required: ['filepath', 'strategy'] } },
  { name: 'heady_conflicts_show', description: 'Show merge conflicts in a specific file with both sides', inputSchema: { type: 'object', properties: { filepath: { type: 'string' } }, required: ['filepath'] } },

  // ── Health & Audit ──────────────────────────────────
  { name: 'heady_health_ping', description: 'Ping all services from the service catalog and report health status', inputSchema: { type: 'object', properties: { timeout: { type: 'number' } } } },
  { name: 'heady_env_audit', description: 'Audit .env — find missing keys, empty values, unused vars', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_deps_scan', description: 'Scan package.json for outdated, duplicate, or vulnerable dependencies', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_config_validate', description: 'Cross-validate YAML configs — service references, pipeline stages', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_secrets_scan', description: 'Scan codebase for accidentally committed secrets, API keys, tokens', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_code_stats', description: 'Project code statistics — lines of code, file counts, language breakdown', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_cloudrun_status', description: 'Show Cloud Run deployment status and service URLs', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_docs_freshness', description: 'Check documentation freshness — find stale docs, missing owners', inputSchema: { type: 'object', properties: {} } },
  { name: 'heady_quickfix', description: 'Run quick automated fixes — remove console.logs, fix trailing whitespace', inputSchema: { type: 'object', properties: { fix: { type: 'string', enum: ['console-logs', 'whitespace', 'line-endings', 'dead-imports', 'all'] }, dryRun: { type: 'boolean' } }, required: ['fix'] } },
  { name: 'heady_cost_report', description: 'Generate cost report — API usage, cloud spend, resource budgets', inputSchema: { type: 'object', properties: {} } },
];
