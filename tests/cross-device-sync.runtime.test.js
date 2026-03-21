const fs = require('fs');
const path = require('path');
const { describe, it, expect, afterAll } = require('vitest');
const { CrossDeviceSyncHub } = require('../src/cross-device-sync');

describe('CrossDeviceSync Runtime Test', () => {
    const storePath = path.join(__dirname, '..', 'tmp', 'sync-runtime-store.json');
    const ingestEvents = [];
    let hub;
    let wsAMessages;
    let wsBMessages;

    it('handles device registration, messaging, and persistence', async () => {
        fs.mkdirSync(path.dirname(storePath), { recursive: true });
        if (fs.existsSync(storePath)) fs.unlinkSync(storePath);

        hub = new CrossDeviceSyncHub({
            storePath,
            vectorMemory: {
                smartIngest: async ({ metadata }) => {
                    ingestEvents.push(metadata.eventType);
                    return 'mem_sync';
                },
            },
        });

        wsAMessages = [];
        wsBMessages = [];
        const wsA = { readyState: 1, send(payload) { wsAMessages.push(payload); }, close() { } };
        const wsB = { readyState: 1, send(payload) { wsBMessages.push(payload); }, close() { } };

        hub._registerDevice('deviceA001', wsA, { name: 'A', platform: 'desktop', userId: 'user-1' });
        hub._registerDevice('deviceB001', wsB, { name: 'B', platform: 'mobile', userId: 'user-1' });

        hub._handleMessage('deviceA001', { type: 'context_update', key: 'task', value: 'ship' });
        hub._handleMessage('deviceA001', { type: 'widget_state_update', state: { panel: 'tasks', expanded: true } });
        hub._handleMessage('deviceB001', {
            type: 'workspace_sync',
            snapshot: {
                vectorWorkspaceId: 'vw-1',
                templates: ['t1', 't2'],
            },
        });
        hub._handleMessage('deviceA001', {
            type: 'template_injection_request',
            request: { requestId: 'req-1' },
        });

        await new Promise((r) => setTimeout(r, 400));

        const status = hub.getStatus();
        expect(status.persistentUsers).toBeGreaterThanOrEqual(1);
        expect(fs.existsSync(storePath)).toBe(true);

        const persisted = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        expect(persisted.users['user-1'].widget.panel).toBe('tasks');
        expect(persisted.workspaces['user-1'].vectorWorkspaceId).toBe('vw-1');
        expect(ingestEvents).toContain('workspace_sync');
        expect(ingestEvents).toContain('template_injection_request');
        expect(wsAMessages.some((payload) => String(payload).includes('template_injection_response'))).toBe(true);

        hub.shutdown();
    });

    afterAll(() => {
        // Clean up temp file
        if (fs.existsSync(storePath)) {
            try { fs.unlinkSync(storePath); } catch (_) { /* ignore */ }
        }
    });
});
