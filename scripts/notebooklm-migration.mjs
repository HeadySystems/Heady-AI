import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const WORKSPACE_DIR = '/home/headyme/workspace';

// We target heady-production explicitly to avoid rewriting the entire workspace multiple times.
const DOCS_DIR = join(WORKSPACE_DIR, 'heady-production', 'docs');
const DB_INFRA_DIR = join(WORKSPACE_DIR, 'heady-production', 'heady-db-infra');

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function updateFile(filePath, updater) {
  try {
    let content = await fs.readFile(filePath, 'utf8');
    const newContent = updater(content);
    if (content !== newContent) {
      await fs.writeFile(filePath, newContent, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  } catch (err) {
    // If file doesn't exist, we skip or handle accordingly
    console.log(`Skipped (not found or error): ${filePath}`);
  }
}

async function run() {
  console.log('--- Phase 1: Reconciling Architecture Drift ---');

  // 1. AGENTS.md
  const agentsUpdater = (content) => {
    return content
      .replace(/Cloud SQL/gi, 'Neon pgvector (T1 Warm Memory)')
      .replace(/384-dimensional/gi, '1536-dimensional')
      .replace(/384d/gi, '1536d')
      + '\n\n## Canonical Memory Contract\n- **T0**: Upstash Redis (Hot Memory)\n- **T1**: Neon pgvector (Warm Memory, 1536 dimensions for storage, 384d projection for edge routing)\n- **T2**: Qdrant Cloud (Cold Archive)\n';
  };
  await updateFile(join(DOCS_DIR, 'AGENTS.md'), agentsUpdater);
  await updateFile(join(WORKSPACE_DIR, 'heady-production', 'AGENTS.md'), agentsUpdater);

  // 2. ARCHITECTURE-aether.md
  await updateFile(join(DOCS_DIR, 'architecture', 'ARCHITECTURE-aether.md'), (content) => {
    return content
      .replace(/384D/gi, '1536D')
      .replace(/Cloud SQL/gi, 'Neon pgvector')
      + '\n\n## Continuous Semantic Logic (CSL) Gates\n- MINIMUM: 0.500\n- LOW: 0.691\n- MEDIUM: 0.809\n- HIGH: 0.882\n- CRITICAL: 0.927\n- DEDUP: 0.972\n';
  });

  // 3. heady-db-infra/README.md
  await updateFile(join(DB_INFRA_DIR, 'README.md'), (content) => {
    return content.replace(/Cloud SQL/gi, 'Cloud SQL (LEGACY - Superseded by Neon pgvector)');
  });

  // 4. MCP.md & heady_mcp_public_readme.md
  const mcpUpdater = (content) => {
    return content
      .replace(/31 tools/gi, '8 core tools (migration-core registry)')
      .replace(/55 production tools/gi, '8 core tools (migration-core registry)')
      + '\n\n## Migration-Core Tool Registry (Frozen)\n1. `heady_chat`\n2. `heady_memory_store`\n3. `heady_memory_search`\n4. `heady_bee_invoke`\n5. `heady_pipeline_enqueue`\n6. `heady_pipeline_status`\n7. `heady_tool_execute`\n8. `heady_file_upload`\n*All other tools are considered extensions.*\n';
  };
  await updateFile(join(DOCS_DIR, 'MCP.md'), mcpUpdater);
  await updateFile(join(DOCS_DIR, 'mcp', 'heady_mcp_public_readme.md'), mcpUpdater);

  // 5. API.md & api-reference/README.md
  const apiUpdater = (content) => {
    return content + '\n\n## T1 Memory Endpoints\n- Vector limits and evidence-class semantics enforced for parser.\n';
  };
  await updateFile(join(DOCS_DIR, 'api', 'API.md'), apiUpdater);
  await updateFile(join(DOCS_DIR, 'api-reference', 'README.md'), apiUpdater);

  // 6. portal/index.md
  await updateFile(join(DOCS_DIR, 'portal', 'index.md'), (content) => {
    return '# NOTEBOOKLM PACK MANIFEST\n\n' + content + '\n\n*Note: Explicit loading order enforced. Legacy documents deprecated.*';
  });

  // 7. ARCHITECTURE-MAP.md
  await updateFile(join(DOCS_DIR, 'architecture', 'ARCHITECTURE-MAP.md'), (content) => {
    return content + '\n\n## Schema Crosswalk\n- `001_core_schema` -> `global`, `user/<id>`\n- `002_990_parser` -> `document/nonprofit/<org_id>`\n- `003_mcp_platform` -> `tool/<name>`\n- `004_thought_billing` -> `billing/<account_id>`\n';
  });

  console.log('\n--- Phase 2: Generating Canonical Blueprints ---');
  const blueprintsDir = join(DOCS_DIR, 'blueprints');
  await ensureDir(blueprintsDir);

  await fs.writeFile(join(blueprintsDir, 'T1_PERSISTENT_MEMORY_SPEC.md'), `# T1 Persistent Memory Specification\n\n**Canonical Scope**: Defines the T1 warm memory layer on Neon pgvector.\n**Version**: 1.0.0\n\n- **Dimension**: 1536d canonical storage (BGE-M3 / OpenAI 3-small)\n- **Projection**: 384d materialized for edge routing\n- **Database**: Neon Postgres >= 0.8.2\n- **Index**: HNSW with \`halfvec\` quantization\n`, 'utf8');

  await fs.writeFile(join(blueprintsDir, 'PGVECTOR_MIGRATION_RUNBOOK.md'), `# PGVector Migration Runbook\n\n**Canonical Scope**: Runbook for backfilling legacy documents into vector storage.\n**Version**: 1.0.0\n\n1. Dual-write layer activation.\n2. Backfill historical assets with deterministic chunking.\n3. Build HNSW indexes post-load.\n4. Parity checks.\n5. φ-stepped traffic cutover.\n`, 'utf8');

  await fs.writeFile(join(blueprintsDir, 'NONPROFIT_PARSER_VERTICAL.md'), `# Nonprofit Parser Vertical\n\n**Canonical Scope**: Defines the HeadyConnection parsing and evidence classes.\n**Version**: 1.0.0\n\n## Entity Resolution\n- **Entity**: HeadyConnection Inc.\n- **State**: Colorado (Good Standing, formed Jan 3, 2026)\n- **Address**: 149 Remington St Apt 425, Fort Collins, CO 80524\n- **Registered Agent**: Eric Anthony Haywood\n\n## IRS Determination Verification\nWe have verified the IRS 501(c)(3) determination letter image.\n- **EIN**: 41-3508351\n- **Date**: 04/06/2026\n- **Effective Date of Exemption**: January 3, 2026\n- **Public Charity Status**: 170(b)(1)(A)(vi)\n- **Contribution Deductibility**: Yes\n\n## Evidence Classes\n1. Authoritative IRS evidence (canonical tax fields)\n2. State registry evidence (identity resolution)\n3. Derived parser evidence (extracted text spans with confidence)\n`, 'utf8');

  await fs.writeFile(join(blueprintsDir, 'NOTEBOOKLM_SOURCEPACK.md'), `# NotebookLM Sourcepack Master\n\n**Canonical Scope**: The 6-pack master table of contents for NotebookLM ingestion.\n**Version**: 1.0.0\n\n1. Platform Overview\n2. Canonical Architecture\n3. Memory and Data Model\n4. MCP and Tool Registry\n5. Nonprofit Parser Vertical\n6. Operations and Deployment\n`, 'utf8');

  console.log('Blueprints generated successfully.');
}

run().catch(console.error);
