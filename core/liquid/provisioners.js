/**
 * Heady™ Liquid Node Provisioners — Platform-Specific Bootstrappers
 * ═════════════════════════════════════════════════════════════════
 *
 * Each provisioner knows how to spin up a Heady liquid node on
 * its target platform. Provisioners are called by the conductor
 * when a capability is needed that no existing node can provide.
 *
 * @module core/liquid/provisioners
 */
'use strict';

const { NODE_TYPE, PLATFORMS } = require('./node-registry');
const { PHI, fib, TIMING } = require('../constants/phi');

// ─── Base Provisioner ───────────────────────────────────────────────────────────

class BaseProvisioner {
  constructor(type) {
    this.type = type;
    this.platform = PLATFORMS[type];
  }

  /** Override in subclasses */
  async provision(opts) {
    throw new Error(`${this.type}: provision() not implemented`);
  }

  async terminate(nodeId) {
    throw new Error(`${this.type}: terminate() not implemented`);
  }

  async healthCheck(nodeId) {
    throw new Error(`${this.type}: healthCheck() not implemented`);
  }
}

// ─── Colab Provisioner ──────────────────────────────────────────────────────────

class ColabProvisioner extends BaseProvisioner {
  constructor() { super(NODE_TYPE.COLAB); }

  async provision(opts = {}) {
    const config = this.platform.config;
    const gpu = opts.gpu || config.accelerator;

    return {
      type: this.type,
      config: {
        runtime: config.runtime,
        accelerator: gpu,
        project: config.project,
        notebookUrl: null, // Populated after Colab API call
        idleTimeout: config.idleTimeout,
      },
      bootstrapScript: this._generateBootstrap(gpu),
      estimatedBootMs: this.platform.bootTimeMs,
    };
  }

  _generateBootstrap(gpu) {
    return [
      '#!/usr/bin/env python3',
      '"""Heady™ Colab Liquid Node Bootstrap"""',
      '',
      '# Install dependencies',
      'import subprocess, sys',
      'subprocess.check_call([sys.executable, "-m", "pip", "install", "-q",',
      '  "torch", "transformers", "sentence-transformers",',
      '  "pgvector", "psycopg2-binary", "fastapi", "uvicorn"])',
      '',
      '# Load embedding model',
      'from sentence_transformers import SentenceTransformer',
      'model = SentenceTransformer("all-MiniLM-L6-v2")',
      `print(f"[heady] Loaded model on {gpu}: {{model.device}}")`,
      '',
      '# Start Heady liquid node API',
      'from fastapi import FastAPI',
      'import uvicorn, numpy as np',
      '',
      'app = FastAPI(title="Heady Liquid Node - Colab")',
      '',
      '@app.get("/_heady/health")',
      'async def health():',
      '    return {"status": "ok", "node": "colab", "gpu": "' + gpu + '"}',
      '',
      '@app.post("/_heady/embed")',
      'async def embed(texts: list[str]):',
      '    vectors = model.encode(texts, normalize_embeddings=True)',
      '    return {"vectors": vectors.tolist(), "dims": vectors.shape[1]}',
      '',
      '@app.post("/_heady/similarity")',
      'async def similarity(query: str, candidates: list[str]):',
      '    q_vec = model.encode([query], normalize_embeddings=True)',
      '    c_vecs = model.encode(candidates, normalize_embeddings=True)',
      '    scores = np.dot(c_vecs, q_vec.T).flatten().tolist()',
      '    return {"scores": scores}',
      '',
      'uvicorn.run(app, host="0.0.0.0", port=8080)',
    ].join('\n');
  }
}

// ─── Cloudflare Provisioner ─────────────────────────────────────────────────────

class CloudflareProvisioner extends BaseProvisioner {
  constructor() { super(NODE_TYPE.CLOUDFLARE); }

  async provision(opts = {}) {
    return {
      type: this.type,
      config: {
        accountId: this.platform.config.accountId,
        compatibilityDate: this.platform.config.compatibilityDate,
        routes: this.platform.config.routes,
      },
      workerScript: this.platform.workerScript,
      wranglerConfig: this._generateWranglerConfig(opts.name || 'heady-liquid'),
      estimatedBootMs: this.platform.bootTimeMs,
    };
  }

  _generateWranglerConfig(name) {
    return {
      name,
      compatibility_date: this.platform.config.compatibilityDate,
      main: 'worker.js',
      kv_namespaces: [
        { binding: 'HEADY_KV', id: 'heady-vector-cache' },
        { binding: 'HEADY_CONFIG', id: 'heady-config' },
      ],
      ai: { binding: 'AI' },
      vars: {
        HEADY_NODE_TYPE: 'cloudflare',
        HEADY_PHI: '1.618033988749895',
      },
    };
  }
}

// ─── Cloud Run Provisioner ──────────────────────────────────────────────────────

class CloudRunProvisioner extends BaseProvisioner {
  constructor() { super(NODE_TYPE.CLOUD_RUN); }

  async provision(opts = {}) {
    const config = this.platform.config;
    const serviceName = opts.service || 'heady-liquid';

    return {
      type: this.type,
      config: {
        project: config.project,
        region: config.region,
        service: serviceName,
        image: `us-east1-docker.pkg.dev/${config.project}/heady/${serviceName}:latest`,
        minInstances: config.minInstances,
        maxInstances: config.maxInstances,
        concurrency: config.concurrency,
        cpu: config.cpu,
        memory: config.memory,
        cpuAlwaysOn: config.cpuAlwaysOn,
      },
      gcloudCommand: this._generateDeployCommand(serviceName, config),
      estimatedBootMs: this.platform.bootTimeMs,
    };
  }

  _generateDeployCommand(service, config) {
    return [
      `gcloud run deploy ${service}`,
      `  --project=${config.project}`,
      `  --region=${config.region}`,
      `  --image=us-east1-docker.pkg.dev/${config.project}/heady/${service}:latest`,
      `  --min-instances=${config.minInstances}`,
      `  --max-instances=${config.maxInstances}`,
      `  --concurrency=${config.concurrency}`,
      `  --cpu=${config.cpu}`,
      `  --memory=${config.memory}`,
      `  --allow-unauthenticated`,
      `  --set-env-vars=HEADY_NODE_TYPE=cloud-run,HEADY_PHI=1.618033988749895`,
    ].join(' \\\n');
  }
}

// ─── AI Studio Provisioner ──────────────────────────────────────────────────────

class AIStudioProvisioner extends BaseProvisioner {
  constructor() { super(NODE_TYPE.AI_STUDIO); }

  async provision(opts = {}) {
    const config = this.platform.config;
    const model = opts.model || config.defaultModel;

    return {
      type: this.type,
      config: {
        model,
        endpoint: `${config.endpoint}/models/${model}`,
        apiKey: config.envKey,
        generationConfig: {
          temperature: 0.618, // PSI
          topP: 0.927,       // CSL.CRITICAL
          topK: fib(8),      // 21
          maxOutputTokens: fib(12) * fib(6), // 144*8 = 1,152
        },
      },
      estimatedBootMs: this.platform.bootTimeMs,
    };
  }
}

// ─── Vertex AI Provisioner ──────────────────────────────────────────────────────

class VertexAIProvisioner extends BaseProvisioner {
  constructor() { super(NODE_TYPE.VERTEX_AI); }

  async provision(opts = {}) {
    const config = this.platform.config;

    return {
      type: this.type,
      config: {
        project: config.project,
        region: config.region,
        endpoints: config.endpoints,
        pipelineRoot: config.pipelineRoot,
      },
      pipelineSpec: this._generatePipelineSpec(opts),
      estimatedBootMs: this.platform.bootTimeMs,
    };
  }

  _generatePipelineSpec(opts = {}) {
    return {
      pipelineSpec: {
        components: {
          'embedding-node': {
            executorLabel: 'exec-embedding',
            inputDefinitions: {
              parameters: { texts: { parameterType: 'LIST' } },
            },
            outputDefinitions: {
              parameters: { vectors: { parameterType: 'LIST' } },
            },
          },
          'prediction-node': {
            executorLabel: 'exec-prediction',
            inputDefinitions: {
              parameters: { prompt: { parameterType: 'STRING' } },
            },
          },
        },
        deploymentSpec: {
          executors: {
            'exec-embedding': {
              container: {
                image: `us-east1-docker.pkg.dev/gen-lang-client-0920560496/heady/heady-embed:latest`,
              },
            },
            'exec-prediction': {
              container: {
                image: `us-east1-docker.pkg.dev/gen-lang-client-0920560496/heady/heady-brain:latest`,
              },
            },
          },
        },
      },
    };
  }
}

// ─── GitHub Actions Provisioner ─────────────────────────────────────────────────

class GitHubActionsProvisioner extends BaseProvisioner {
  constructor() { super(NODE_TYPE.GITHUB); }

  async provision(opts = {}) {
    const config = this.platform.config;
    const workflow = opts.workflow || 'liquid-node';

    return {
      type: this.type,
      config: {
        org: config.org,
        repo: config.repo,
        workflow,
      },
      workflowYaml: this._generateWorkflow(workflow),
      estimatedBootMs: this.platform.bootTimeMs,
    };
  }

  _generateWorkflow(name) {
    return {
      name: `Heady Liquid Node: ${name}`,
      on: { workflow_dispatch: { inputs: { task: { required: true, type: 'string' } } } },
      jobs: {
        'liquid-node': {
          'runs-on': 'ubuntu-latest',
          steps: [
            { uses: 'actions/checkout@v4' },
            { uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
            { run: 'npm ci', 'working-directory': 'services/heady-mcp-server' },
            { run: 'node -e "const h = require(\'./core\'); console.log(JSON.stringify(h.createSystem().conductor.health()))"' },
          ],
        },
      },
    };
  }
}

// ─── Gist Provisioner ───────────────────────────────────────────────────────────

class GistProvisioner extends BaseProvisioner {
  constructor() { super(NODE_TYPE.GIST); }

  async provision(opts = {}) {
    const config = this.platform.config;
    const prefix = opts.prefix || 'config';

    return {
      type: this.type,
      config: {
        owner: config.owner,
        endpoint: config.apiEndpoint,
        prefix: config.prefixes[prefix] || config.prefixes.config,
      },
      // Gists are used for config/snippet storage, not compute
      sampleGist: {
        description: `Heady™ ${prefix} — φ-scaled configuration`,
        public: false,
        files: {
          [`heady-${prefix}.json`]: {
            content: JSON.stringify({
              version: '5.3.0',
              phi: 1.618033988749895,
              createdAt: new Date().toISOString(),
              type: prefix,
            }, null, 2),
          },
        },
      },
      estimatedBootMs: this.platform.bootTimeMs,
    };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────────

const PROVISIONER_MAP = {
  [NODE_TYPE.COLAB]:      ColabProvisioner,
  [NODE_TYPE.CLOUDFLARE]: CloudflareProvisioner,
  [NODE_TYPE.CLOUD_RUN]:  CloudRunProvisioner,
  [NODE_TYPE.AI_STUDIO]:  AIStudioProvisioner,
  [NODE_TYPE.VERTEX_AI]:  VertexAIProvisioner,
  [NODE_TYPE.GITHUB]:     GitHubActionsProvisioner,
  [NODE_TYPE.GIST]:       GistProvisioner,
};

function getProvisioner(type) {
  const Cls = PROVISIONER_MAP[type];
  if (!Cls) throw new Error(`No provisioner for type: ${type}`);
  return new Cls();
}

function getAllProvisioners() {
  return Object.keys(PROVISIONER_MAP).map(type => getProvisioner(type));
}

module.exports = {
  getProvisioner, getAllProvisioners,
  ColabProvisioner, CloudflareProvisioner, CloudRunProvisioner,
  AIStudioProvisioner, VertexAIProvisioner, GitHubActionsProvisioner, GistProvisioner,
};
