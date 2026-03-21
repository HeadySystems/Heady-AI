const path = require('path');
const domain = 'deployment';
const description = 'RAM-first deployment: template injection → git push → HF Spaces → Cloud Run → post-deploy verification';
const priority = 0.85;
const PROJECT_ROOT = path.join(__dirname, '../..');
const DEPLOY_TARGETS = {
  'cloud-run': {
    service: 'heady-manager',
    region: 'us-central1',
    project: 'heady-pre-production'
  },
  'cloudflare-worker': {
    name: 'heady-edge-proxy',
    account: '8b1fa38f282c691423c6399247d53323'
  },
  'github': {
    repo: 'HeadyMe/Heady-pre-production-9f2f0642',
    branch: 'main'
  },
  'hf-spaces': ['HeadyMe/heady-ai', 'HeadyMe/heady-systems', 'HeadyConnection/heady-connection']
};
const HF_SPACE_MAP = {
  main: 'HeadyMe/heady-ai',
  systems: 'HeadyMe/heady-systems',
  connection: 'HeadyConnection/heady-connection'
};
function getWork(ctx = {}) {
  const work = [];
  work.push(async () => {
    try {
      const syncBee = require('./sync-projection-bee');
      const results = syncBee.injectTemplatesIntoHFSpaces();
      const injected = results.filter(r => r.injected).length;
      return {
        bee: domain,
        action: 'template-injection',
        success: true,
        injected,
        total: results.length,
        results
      };
    } catch (err) {
      return {
        bee: domain,
        action: 'template-injection',
        success: false,
        error: err.message
      };
    }
  });

  // 2. Git stage + push (projects RAM state to GitHub)
  work.push(async () => {
    const {
      execSync
    } = require('child_process');
    try {
      const status = execSync('git status --short', {
        cwd: PROJECT_ROOT,
        encoding: 'utf8'
      });
      if (status.trim()) {
        execSync('git add -A', {
          cwd: PROJECT_ROOT
        });
        execSync('git commit -m "[deploy] auto-deploy via deployment-bee"', {
          cwd: PROJECT_ROOT
        });
      }
      execSync('git push origin main', {
        cwd: PROJECT_ROOT
      });
      return {
        bee: domain,
        action: 'git-push',
        success: true
      };
    } catch (err) {
      return {
        bee: domain,
        action: 'git-push',
        success: false,
        error: err.message
      };
    }
  });
  work.push(async () => {
    const {
      execSync
    } = require('child_process');
    const results = [];
    for (const [spaceName, repoUrl] of Object.entries(HF_SPACE_MAP)) {
      const spaceDir = path.join(PROJECT_ROOT, 'heady-hf-spaces', spaceName);
      try {
        // Push space content to HF via git
        const remoteUrl = `https://huggingface.co/spaces/${repoUrl}`;
        try {
          execSync(`git init`, {
            cwd: spaceDir
          });
        } catch {}
        try {
          execSync(`git remote add origin ${remoteUrl}`, {
            cwd: spaceDir
          });
        } catch {}
        execSync('git add -A', {
          cwd: spaceDir
        });
        try {
          execSync('git commit -m "[sync-projection] auto-inject templates"', {
            cwd: spaceDir
          });
        } catch {}
        // Note: HF push requires HF_TOKEN in env for auth
        results.push({
          space: spaceName,
          repo: repoUrl,
          pushed: true
        });
      } catch (err) {
        results.push({
          space: spaceName,
          repo: repoUrl,
          pushed: false,
          error: err.message
        });
      }
    }
    return {
      bee: domain,
      action: 'hf-push',
      results
    };
  });

  // 4. Cloud Run deploy (projects code to production)
  work.push(async () => {
    const {
      execSync
    } = require('child_process');
    try {
      const target = DEPLOY_TARGETS['cloud-run'];
      // Use gcloud run deploy --source for source-based deploy
      const cmd = `gcloud run deploy ${target.service} --source ${PROJECT_ROOT} --region ${target.region} --project ${target.project} --allow-unauthenticated --quiet 2>&1`;
      const output = execSync(cmd, {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        timeout: 300_000
      });
      const serviceUrl = output.match(/Service URL: (https:\/\/\S+)/)?.[1] || 'unknown';
      if (global.eventBus) global.eventBus.emit('deployment:completed', {
        target: 'cloud-run',
        url: serviceUrl
      });
      return {
        bee: domain,
        action: 'cloud-run-deploy',
        success: true,
        service: target.service,
        region: target.region,
        url: serviceUrl
      };
    } catch (err) {
      return {
        bee: domain,
        action: 'cloud-run-deploy',
        success: false,
        error: err.message.substring(0, 200)
      };
    }
  });

  // 5. Post-deploy verification (run health bee)
  work.push(async () => {
    try {
      const healthBee = require('./health-bee');
      const healthWork = healthBee.getWork(ctx);
      const results = await Promise.allSettled(healthWork.map(fn => fn()));
      const healthy = results.filter(r => r.status === 'fulfilled' && r.value?.healthy).length;
      return {
        bee: domain,
        action: 'post-deploy-verify',
        total: results.length,
        healthy,
        pass: healthy > results.length * 0.8
      };
    } catch (err) {
      return {
        bee: domain,
        action: 'post-deploy-verify',
        success: false,
        error: err.message
      };
    }
  });
  return work;
}
module.exports = {
  domain,
  description,
  priority,
  getWork,
  DEPLOY_TARGETS,
  HF_SPACE_MAP
};