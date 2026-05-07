/**
 * ProvisioningBee — Rapid Kiosk Hardware Setup
 * 
 * Automates the initialization and registration of new distributed nodes.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ProvisioningBee {
    constructor() {
        this.configPath = path.join(process.cwd(), 'k8s', 'manifests', 'liquid-nodes');
    }

    /**
     * Provision a new hardware node.
     * @param {object} specs — Hardware specs (cpu, memory, disk)
     */
    async provisionNode(specs = {}) {
        const nodeId = `knode-${uuidv4().slice(0, 8)}`;
        console.log(`🛠️ [Provisioning] Initializing node: ${nodeId}`);

        const config = {
            nodeId,
            status: 'provisioning',
            createdAt: new Date().toISOString(),
            specs: {
                cpu: specs.cpu || 4,
                memory: specs.memory || '8Gi',
                storage: specs.storage || '100GB'
            },
            security: {
                tailscaleId: `ts-${nodeId}`,
                mtlsSecret: `sec-${uuidv4().slice(0, 16)}`
            }
        };

        // Generate deployment payload
        const payload = `
# Heady™ Node Boot Config
NODE_ID=${nodeId}
MTLS_TOKEN=${config.security.mtlsSecret}
TAILSCALE_AUTH_KEY=tskey-auth-${uuidv4().slice(0, 12)}
PHASE=PROD
        `;

        const payloadPath = path.join(this.configPath, `${nodeId}-boot.env`);
        fs.writeFileSync(payloadPath, payload);
        
        console.log(`✅ [Provisioning] Node initialized. Payload saved to: ${payloadPath}`);
        
        return config;
    }
}

module.exports = new ProvisioningBee();
