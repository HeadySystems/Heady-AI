/*
 * © 2026 Heady™Systems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * AutoCommitDeploy — Permanent Git Auto-Commit, Push & Deploy Cycle
 *
 * Runs on a configurable interval (default: every 5 minutes).
 * Detects dirty working tree → stages all → commits with timestamp → pushes → logs.
 * Designed to be wired into the HCFullPipeline / AutoSuccessEngine lifecycle.
 *
 * ENV controls:
 *   AUTO_DEPLOY_INTERVAL_MS  — cycle interval (default 300000 = 5 min)
 *   AUTO_DEPLOY_BRANCH       — branch to push (default "main")
 *   AUTO_DEPLOY_REMOTE       — remote name (default "origin")
 *   AUTO_DEPLOY_ENABLED      — set to "false" to disable (default "true")
 */

const { execSync, exec } = require("child_process");
const path = require("path");
const { PHI_TIMING } = require('../shared/phi-math');
const logger = require("./utils/logger");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const BRANCH = process.env.AUTO_DEPLOY_BRANCH || "main";
const REMOTE = process.env.AUTO_DEPLOY_REMOTE || "origin";
const MAX_PUSH_RETRIES = 4;
const RETRY_BASE_MS = 2000; // exponential backoff: 2s, 4s, 8s, 16s

// Multi-remote support: comma-separated list of remotes
const ALL_REMOTES = (process.env.AUTO_DEPLOY_REMOTES || REMOTE).split(",").map(r => r.trim()).filter(Boolean);

class AutoCommitDeploy {
    constructor(opts = {}) {
        this.interval = opts.interval || parseInt(process.env.AUTO_DEPLOY_INTERVAL_MS, 10) || DEFAULT_INTERVAL;
        this.enabled = (process.env.AUTO_DEPLOY_ENABLED || "true") !== "false";
        this.running = false;
        this.timer = null;
        this.cycleCount = 0;
        this.lastCommitHash = null;
        this.lastPushTs = null;
        this.remotes = opts.remotes || ALL_REMOTES;
        this.stats = { commits: 0, pushes: 0, errors: 0, noChanges: 0, retries: 0, driftDetected: 0 };
    }

    /** Start the auto-commit/push cycle */
    start() {
        if (!this.enabled) {
            logger.info("[AutoCommitDeploy] Disabled via AUTO_DEPLOY_ENABLED=false");
            return;
        }
        if (this.running) return;
        this.running = true;
        logger.info(`[AutoCommitDeploy] Started — cycling every ${this.interval / 1000}s on ${REMOTE}/${BRANCH}`);

        // Run immediately, then schedule
        this._cycle();
        this.timer = setInterval(() => this._cycle(), this.interval);

        // Drift detection every 3 cycles (15 min default)
        this._driftTimer = setInterval(() => this.detectDrift(), this.interval * 3);
    }

    /** Stop the cycle */
    stop() {
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this._driftTimer) {
            clearInterval(this._driftTimer);
            this._driftTimer = null;
        }
        logger.info("[AutoCommitDeploy] Stopped", { stats: this.stats });
    }

    /** Single commit-push cycle */
    _cycle() {
        this.cycleCount++;
        try {
            // 1. Check for dirty working tree
            const status = this._exec("git status --porcelain").trim();
            if (!status) {
                this.stats.noChanges++;
                return; // Nothing to commit — clean exit
            }

            // 2. Stage all changes
            this._exec("git add -A");

            // 3. Commit with auto-generated message
            const ts = new Date().toISOString();
            const fileCount = status.split("\n").length;
            const msg = `auto: pipeline cycle #${this.cycleCount} — ${fileCount} file(s) @ ${ts}`;
            this._exec(`git commit -m "${msg}"`);

            // 4. Capture commit hash
            this.lastCommitHash = this._exec("git rev-parse --short HEAD").trim();
            this.stats.commits++;
            logger.info(`[AutoCommitDeploy] Committed ${this.lastCommitHash}: ${fileCount} file(s)`);

            // 5. Push (async to avoid blocking the event loop)
            this._pushAsync();

        } catch (err) {
            this.stats.errors++;
            logger.error("[AutoCommitDeploy] Cycle error", { cycle: this.cycleCount, error: err.message });
        }
    }

    /** Async push with exponential backoff retry to all configured remotes */
    _pushAsync() {
        for (const remote of this.remotes) {
            this._pushToRemoteWithRetry(remote, 0);
        }
    }

    /** Push to a single remote with exponential backoff retry */
    _pushToRemoteWithRetry(remote, attempt) {
        exec(`git push -u ${remote} ${BRANCH}`, { cwd: REPO_ROOT }, (err, stdout, stderr) => {
            if (err) {
                if (attempt < MAX_PUSH_RETRIES) {
                    const delay = RETRY_BASE_MS * Math.pow(2, attempt);
                    this.stats.retries++;
                    logger.warn(`[AutoCommitDeploy] Push to ${remote} failed (attempt ${attempt + 1}/${MAX_PUSH_RETRIES}), retrying in ${delay}ms`, { error: err.message });
                    setTimeout(() => this._pushToRemoteWithRetry(remote, attempt + 1), delay);
                    return;
                }
                this.stats.errors++;
                logger.error(`[AutoCommitDeploy] Push to ${remote} failed after ${MAX_PUSH_RETRIES} retries`, { error: err.message, stderr });
                if (global.eventBus) {
                    global.eventBus.emit("auto-deploy:push-failed", { remote, branch: BRANCH, error: err.message, cycle: this.cycleCount });
                }
                return;
            }
            this.lastPushTs = Date.now();
            this.stats.pushes++;
            logger.info(`[AutoCommitDeploy] Pushed ${this.lastCommitHash} → ${remote}/${BRANCH}`);

            if (global.eventBus) {
                global.eventBus.emit("auto-deploy:pushed", {
                    commit: this.lastCommitHash,
                    branch: BRANCH,
                    remote,
                    ts: this.lastPushTs,
                    cycle: this.cycleCount,
                });
            }
        });
    }

    /** Detect config drift between local and remote */
    detectDrift() {
        try {
            for (const remote of this.remotes) {
                try {
                    this._exec(`git fetch ${remote} ${BRANCH}`);
                } catch (e) {
                    logger.warn(`[AutoCommitDeploy] Drift check: fetch from ${remote} failed`, { error: e.message });
                    continue;
                }
                const diff = this._exec(`git diff HEAD ${remote}/${BRANCH} --stat`).trim();
                if (diff) {
                    this.stats.driftDetected++;
                    logger.warn(`[AutoCommitDeploy] Drift detected on ${remote}/${BRANCH}`, { diff: diff.split("\n").length + " files" });
                    if (global.eventBus) {
                        global.eventBus.emit("auto-deploy:drift-detected", { remote, branch: BRANCH, fileCount: diff.split("\n").length });
                    }
                }
            }
        } catch (err) {
            logger.error("[AutoCommitDeploy] Drift detection error", { error: err.message });
        }
    }

    /** Synchronous exec helper */
    _exec(cmd) {
        return execSync(cmd, { cwd: REPO_ROOT, encoding: "utf8", timeout: PHI_TIMING.CYCLE });
    }

    /** Get current status */
    getStatus() {
        return {
            enabled: this.enabled,
            running: this.running,
            autonomous: true,
            cycleCount: this.cycleCount,
            intervalMs: this.interval,
            remotes: this.remotes,
            branch: BRANCH,
            lastCommitHash: this.lastCommitHash,
            lastPushTs: this.lastPushTs,
            maxRetries: MAX_PUSH_RETRIES,
            retryBaseMs: RETRY_BASE_MS,
            driftCheckIntervalMs: this.interval * 3,
            stats: { ...this.stats },
        };
    }
}

// Singleton
const autoCommitDeploy = new AutoCommitDeploy();
module.exports = autoCommitDeploy;
