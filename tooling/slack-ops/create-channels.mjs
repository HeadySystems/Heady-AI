// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Slack Ops — Channel Bootstrap v1.0.0                      ║
// ║  Creates the Heady async-feed Slack channels via the Slack API.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env relative to the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../.env') });

const token = process.env.SLACK_API_TOKEN;

if (!token) {
  console.error('ERROR: SLACK_API_TOKEN is missing in .env');
  process.exit(1);
}

const channels = [
  'ops-incidents',
  'ops-csl-gates',
  'ops-cost-guardian',
  'swarm-coder',
  'swarm-security',
  'swarm-arbiter',
  'swarm-creative',
  'eng-deployments',
  'eng-vector-memory',
  'eng-linear-sync',
  'exec-series-a',
  'exec-ip-patents'
];

// φ-scaled backoff in ms (1.618 seconds)
const PHI_DELAY_MS = 1618;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function createChannels() {
  console.log('Initiating Heady Slack Channel Scaffold...');
  
  for (const channelName of channels) {
    try {
      const response = await fetch('https://slack.com/api/conversations.create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          name: channelName,
          is_private: false
        })
      });

      const data = await response.json();

      if (data.ok) {
        console.log(`✅ Successfully created channel: #${channelName} (ID: ${data.channel.id})`);
      } else {
        if (data.error === 'name_taken') {
          console.log(`⚠️ Channel #${channelName} already exists. Skipping.`);
        } else {
          console.error(`❌ Failed to create #${channelName}: ${data.error}`);
        }
      }
    } catch (err) {
      console.error(`❌ Network error while creating #${channelName}:`, err.message);
    }
    
    // Apply φ-scaled backoff to avoid rate limits
    await sleep(PHI_DELAY_MS);
  }
  
  console.log('Scaffold complete.');
}

createChannels();
