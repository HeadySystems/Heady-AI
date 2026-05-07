/**
 * Heady™ Liquid Node Multi-Region Deployment
 */

import { HeadyOperator } from '../../services/heady-orchestration/k8s-operator.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REGIONS = ['us-east1', 'europe-west1', 'asia-northeast1'];
const APP_ROLES = ['manager', 'mcp', 'worker', 'gateway'];

async function deploy() {
    console.log('🚀 [Deployment] Initiating Liquid Node Global Deployment...');
    
    const operator = new HeadyOperator();
    const manifestDir = path.join(process.cwd(), 'k8s', 'manifests', 'liquid-nodes');
    
    if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true });
    }

    const deploymentPlan = [];

    for (const region of REGIONS) {
        console.log(`\n📍 [Region] ${region}`);
        
        for (const role of APP_ROLES) {
            const appConfig = {
                name: `heady-${role}-${region}`,
                role: role,
                replicas: region === 'us-east1' ? 3 : 1,
                cpu: role === 'worker' ? '4' : '1',
                memory: role === 'worker' ? '8Gi' : '512Mi',
                gpu: role === 'worker',
            };

            const yaml = operator.generateYAML(appConfig);
            const fileName = `${appConfig.name}.yaml`;
            fs.writeFileSync(path.join(manifestDir, fileName), yaml);
            
            console.log(`   ✅ Generated manifest: ${fileName}`);
            deploymentPlan.push({ region, name: appConfig.name, role: appConfig.role });
        }
    }

    console.log('\n🌍 [Deployment] Global Deployment Plan Finalized.');
    return deploymentPlan;
}

deploy().catch(console.error);
