import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
    ColabRuntimeManager,
    LATENT_OPS,
    RUNTIME_STATE,
} from '../../core/liquid-nodes/colab-runtime.js';

describe('ColabRuntimeManager distributed orchestration', () => {
    it('provisions all three Colab runtimes concurrently and reports aggregate status', async () => {
        const manager = new ColabRuntimeManager();
        manager.initialize();

        const summary = await manager.provisionAll();

        assert.equal(summary.total, 3);
        assert.equal(summary.provisioned.length, 3);
        assert.equal(summary.failed.length, 0);
        assert.equal(summary.successRate, 1);

        const cluster = manager.getClusterStatus();
        assert.equal(cluster.totalRuntimes, 3);
        assert.equal(cluster.activeRuntimes, 3);
    });

    it('executes distributed latent ops across runtime mesh', async () => {
        const manager = new ColabRuntimeManager();
        manager.initialize();
        await manager.provisionAll();

        const payloads = Array.from({ length: 6 }, (_, index) => ({
            taskVector: { x: 0.2 + index * 0.1, y: 1.0, z: 0.4 },
            texts: [`sample-${index}`],
        }));

        const result = await manager.executeDistributed(LATENT_OPS.EMBED, payloads);

        assert.equal(result.total, payloads.length);
        assert.equal(result.failed, 0);
        assert.equal(result.succeeded, payloads.length);

        const runtimeIds = new Set(result.successes.map((entry) => entry.runtimeId));
        assert.ok(runtimeIds.size >= 2, 'Expected distribution across at least two runtimes');
    });

    it('exposes a health matrix with pressure and queue telemetry', async () => {
        const manager = new ColabRuntimeManager();
        manager.initialize();
        await manager.provisionAll();

        const health = manager.getHealthMatrix();

        assert.equal(health.length, 3);
        for (const runtime of health) {
            assert.equal(typeof runtime.runtimeId, 'string');
            assert.ok(Object.values(RUNTIME_STATE).includes(runtime.state));
            assert.equal(typeof runtime.utilization, 'number');
            assert.equal(typeof runtime.pressure, 'string');
            assert.equal(typeof runtime.queueDepth, 'number');
        }
    });
});
