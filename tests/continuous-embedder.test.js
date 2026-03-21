import { describe, it, expect } from 'vitest';

describe('continuous-embedder', () => {
  it('passes all checks', () => {
const embedder = require('../src/services/continuous-embedder');

describe('Continuous Embedder Enterprise Capture', () => {
    it('queueForEmbed accepts valid content', () => {
        const before = embedder.getStats().queueLength;
        const queueResult = embedder.queueForEmbed('hello world', { domain: 'manual' });
        expect(queueResult).toBe(true);
        expect(embedder.getStats().queueLength).toBe(before + 1);
    });

    it('queueForEmbed rejects empty content', () => {
        const emptyResult = embedder.queueForEmbed('', { domain: 'manual' });
        expect(emptyResult).toBe(false);
    });

    it('analyst/system/user events are queued for embedding', () => {
        const before = embedder.getStats().queueLength;
        embedder.onAnalystAction({ analystId: 'a1', action: 'triage', artifact: 'issue-41', note: 'Root cause mapped' });
        embedder.onSystemAction({ actor: 'orchestrator', action: 'reroute', target: 'edge-proxy', outcome: 'success' });
        embedder.onUserInteraction({ message: 'ship this', response: 'done', userId: 'u1', sessionId: 's1' });

        const afterEvents = embedder.getStats().queueLength;
        expect(afterEvents).toBeGreaterThanOrEqual(before + 3);
    });

    it('syncProjections queries vector memory correctly', async () => {
        const vmMock = {
            calls: [],
            async queryMemory(query, topK, filter) {
                this.calls.push({ query, topK, filter });
                return [{ id: 'v1' }];
            },
            async smartIngest() {
                return 'mem_1';
            },
            buildOutboundRepresentation({ channel, topK }) {
                return {
                    profile: channel === 'public-api' ? 'spherical' : 'cartesian',
                    sample: Array.from({ length: Number(topK || 1) }).map((_, i) => ({ id: `vec_${i}`, zone: i % 2, type: 'widget', representation: { x: i, y: i, z: i } })),
                };
            },
        };

        await embedder.start(vmMock);
        embedder.onDeployment({ target: 'cloud-run', status: 'completed' });
        await embedder.syncProjections();
        embedder.stop();

        expect(vmMock.calls.length).toBeGreaterThan(0);
        expect(typeof vmMock.calls[0].query).toBe('string');
        expect(vmMock.calls[0].topK).toBe(5);
        expect(typeof vmMock.calls[0].filter).toBe('object');
    });

    it('stats exposes projection state', () => {
        const stats = embedder.getStats();
        expect(typeof stats.projections).toBe('object');
    });

    it('live context snapshot returns ok with counts', async () => {
        const context = await embedder.buildLiveContextSnapshot();
        expect(context.ok).toBe(true);
        expect(context.counts).toBeDefined();
        expect(typeof context.counts).toBe('object');
    });

    const stats = embedder.getStats();
    assert(typeof stats.projections === 'object', 'stats exposes projection state');

    const context = await embedder.buildLiveContextSnapshot();
    assert(context.ok === true, 'live context snapshot returns ok');
    assert(context.counts && typeof context.counts === 'object', 'live context snapshot includes counts');

    const templates = await embedder.buildInjectableTemplates({ topK: 3, channel: 'public-api' });
    assert(templates.ok === true, 'injectable templates returns ok');
    assert(templates.templateCount === 3, 'injectable templates count respects topK');

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    // process.exitCode removed for vitest
}

run().catch((err) => {
    console.error(err);
    // process.exitCode removed for vitest
});

  });
});
