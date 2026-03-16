/**
 * @fileoverview Heady Discord Bot — Full Fastify-based Discord bot service
 * Connects to Discord gateway, registers slash commands for 20 AI nodes,
 * proxies commands to Heady API, and provides health/webhook endpoints.
 *
 * @module discord-bot
 * @version 1.0.0
 * @port 3320
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const Fastify = require('fastify');
const http = require('http');
const https = require('https');

// discord.js is loaded lazily — only when a real token is configured
let Discord = null;
try { Discord = require('discord.js'); } catch { /* scaffold mode — discord.js not installed */ }

// ─── Config ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3320', 10);
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const HEADY_API = process.env.HEADY_API_URL || 'https://manager.headysystems.com';
const SERVICE_NAME = 'heady-discord-bot';
const VERSION = '1.0.0';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// ─── 20 AI Nodes ────────────────────────────────────────────────────────────
const AI_NODES = [
  { id: 'brain',      name: 'HeadyBrain',      emoji: '🧠', desc: 'Meta-intelligence orchestrator' },
  { id: 'buddy',      name: 'HeadyBuddy',      emoji: '🐝', desc: 'Personal AI assistant' },
  { id: 'battle',     name: 'HeadyBattle',      emoji: '⚔️', desc: 'Multi-model arena orchestrator' },
  { id: 'creative',   name: 'HeadyCreative',    emoji: '🎨', desc: 'Creative content generation' },
  { id: 'conductor',  name: 'HeadyConductor',   emoji: '🎭', desc: 'Task orchestration engine' },
  { id: 'distiller',  name: 'HeadyDistiller',   emoji: '⚗️', desc: 'Knowledge distillation' },
  { id: 'gateway',    name: 'HeadyGateway',     emoji: '🌐', desc: 'API gateway & routing' },
  { id: 'guardian',   name: 'HeadyGuardian',    emoji: '🛡️', desc: 'Security & compliance' },
  { id: 'harvest',    name: 'HeadyHarvest',     emoji: '🌾', desc: 'Data collection & ingestion' },
  { id: 'lattice',    name: 'HeadyLattice',     emoji: '🔮', desc: 'Vector space operations' },
  { id: 'logic',      name: 'HeadyLogic',       emoji: '🧮', desc: 'Reasoning & inference' },
  { id: 'memory',     name: 'HeadyMemory',      emoji: '💾', desc: 'Persistent memory layer' },
  { id: 'mirror',     name: 'HeadyMirror',      emoji: '🪞', desc: 'Self-reflection & audit' },
  { id: 'nexus',      name: 'HeadyNexus',       emoji: '🔗', desc: 'Cross-service integration' },
  { id: 'oracle',     name: 'HeadyOracle',      emoji: '🔭', desc: 'Predictive analytics' },
  { id: 'pulse',      name: 'HeadyPulse',       emoji: '💓', desc: 'System health monitoring' },
  { id: 'scribe',     name: 'HeadyScribe',      emoji: '📝', desc: 'Documentation generation' },
  { id: 'sentinel',   name: 'HeadySentinel',    emoji: '👁️', desc: 'Anomaly detection' },
  { id: 'spark',      name: 'HeadySpark',       emoji: '⚡', desc: 'Quick task execution' },
  { id: 'weaver',     name: 'HeadyWeaver',      emoji: '🕸️', desc: 'Context threading' },
];

// ─── Discord Client ─────────────────────────────────────────────────────────
let discordClient = null;
let botConnected = false;
let guildCount = 0;
let commandsRegistered = false;

/**
 * Build slash commands for /heady <node>
 */
function buildSlashCommands() {
  if (!Discord) return [];
  const { SlashCommandBuilder } = Discord;

  const heady = new SlashCommandBuilder()
    .setName('heady')
    .setDescription('Invoke a Heady AI node');

  for (const node of AI_NODES) {
    heady.addSubcommand(sub =>
      sub
        .setName(node.id)
        .setDescription(`${node.emoji} ${node.name} — ${node.desc}`)
        .addStringOption(opt =>
          opt.setName('prompt')
            .setDescription('Your prompt or query')
            .setRequired(true)
        )
    );
  }

  const status = new SlashCommandBuilder()
    .setName('heady-status')
    .setDescription('🏥 Get Heady system status');

  const nodes = new SlashCommandBuilder()
    .setName('heady-nodes')
    .setDescription('📋 List all 20 AI nodes');

  return [heady, status, nodes];
}

/**
 * Register slash commands with Discord API
 */
async function registerCommands(logger) {
  if (!Discord || !BOT_TOKEN || !CLIENT_ID || BOT_TOKEN === 'test-token-12345') return;
  const { REST, Routes } = Discord;

  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  const commands = buildSlashCommands().map(cmd => cmd.toJSON());

  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    commandsRegistered = true;
    logger.info({ commands: commands.length }, 'Slash commands registered globally');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to register slash commands');
  }
}

/**
 * Proxy a request to the Heady API
 */
function callHeadyApi(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, HEADY_API);
    const client = url.protocol === 'https:' ? https : http;

    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source-Service': SERVICE_NAME,
      },
      timeout: 15000,
    };

    const req = client.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('API timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Initialize Discord.js client
 */
function initDiscordClient(logger) {
  if (!Discord || !BOT_TOKEN || BOT_TOKEN === 'test-token-12345') {
    logger.info('Discord bot in scaffold mode (no valid token or discord.js not installed)');
    return;
  }

  const { Client, GatewayIntentBits, Events } = Discord;

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  discordClient.on(Events.ClientReady, (c) => {
    botConnected = true;
    guildCount = c.guilds.cache.size;
    logger.info({ user: c.user.tag, guilds: guildCount }, 'Discord bot connected');
  });

  discordClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // /heady <node> <prompt>
    if (commandName === 'heady') {
      const subCmd = interaction.options.getSubcommand();
      const prompt = interaction.options.getString('prompt');
      const node = AI_NODES.find(n => n.id === subCmd);

      if (!node) {
        await interaction.reply({ content: '❌ Unknown node', ephemeral: true });
        return;
      }

      await interaction.deferReply();

      try {
        const result = await callHeadyApi(`/api/v1/nodes/${node.id}/invoke`, {
          prompt,
          userId: interaction.user.id,
          channel: interaction.channelId,
          source: 'discord',
        });

        const response = result.response || result.reply || result.raw || JSON.stringify(result);
        const truncated = String(response).substring(0, 1900);
        await interaction.editReply(`${node.emoji} **${node.name}**\n\n${truncated}`);
      } catch (err) {
        logger.error({ err: err.message, node: node.id }, 'Node invocation failed');
        await interaction.editReply(`⚠️ ${node.name} is temporarily unavailable. Error: ${err.message}`);
      }
    }

    // /heady-status
    if (commandName === 'heady-status') {
      try {
        const health = await callHeadyApi('/api/v1/health', null);
        await interaction.reply({
          content: `🏥 **Heady System Status**\n\`\`\`json\n${JSON.stringify(health, null, 2).substring(0, 1800)}\n\`\`\``,
        });
      } catch (err) {
        await interaction.reply({ content: `⚠️ Could not reach Heady API: ${err.message}`, ephemeral: true });
      }
    }

    // /heady-nodes
    if (commandName === 'heady-nodes') {
      const list = AI_NODES.map(n => `${n.emoji} **${n.name}** — ${n.desc}`).join('\n');
      await interaction.reply({ content: `📋 **20 Heady AI Nodes**\n\n${list}` });
    }
  });

  discordClient.on(Events.Error, (err) => {
    logger.error({ err: err.message }, 'Discord client error');
  });

  discordClient.login(BOT_TOKEN).catch(err => {
    logger.error({ err: err.message }, 'Discord login failed');
  });
}

// ─── Fastify App ────────────────────────────────────────────────────────────

const app = Fastify({
  logger: {
    level: LOG_LEVEL,
    transport: LOG_LEVEL === 'silent' ? undefined : undefined,
  },
  trustProxy: true,
});

// ── Security Headers ──
app.addHook('onSend', async (req, reply) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '0');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  reply.header('X-Service', SERVICE_NAME);
});

// ── Health ──
app.get('/health', async () => ({
  status: 'ok',
  service: SERVICE_NAME,
  version: VERSION,
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  discord: {
    connected: botConnected,
    guilds: guildCount,
    commandsRegistered,
  },
}));

app.get('/health/live', async () => ({
  status: 'ok',
}));

app.get('/health/ready', async (req, reply) => {
  if (BOT_TOKEN) {
    return { status: 'ok' };
  }
  reply.code(503);
  return { status: 'not_ready', reason: 'DISCORD_BOT_TOKEN not configured' };
});

// ── Discord Webhook (Interactions endpoint) ──
app.post('/webhook/discord', async (req) => {
  const body = req.body || {};

  // Discord verification ping (type 1)
  if (body.type === 1) {
    return { type: 1 };
  }

  // Interaction callback (type 2 = APPLICATION_COMMAND)
  if (body.type === 2) {
    const data = body.data || {};
    return {
      type: 4,
      data: {
        content: `🧠 Processing /${data.name || 'heady'} via webhook...`,
      },
    };
  }

  return { type: 1 };
});

// ── Bot Status ──
app.get('/bot/status', async () => ({
  connected: botConnected,
  guilds: guildCount,
  commandsRegistered,
  nodes: AI_NODES.length,
  note: botConnected
    ? `Bot is live in ${guildCount} server(s) with ${AI_NODES.length} AI nodes`
    : 'Bot is in scaffold mode — set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID to connect',
}));

// ── Node List ──
app.get('/nodes', async () => ({
  count: AI_NODES.length,
  nodes: AI_NODES,
}));

// ── Invoke Node (HTTP API — same as what Discord commands call) ──
app.post('/invoke/:nodeId', async (req, reply) => {
  const { nodeId } = req.params;
  const node = AI_NODES.find(n => n.id === nodeId);

  if (!node) {
    reply.code(404);
    return { error: 'Unknown node', nodeId };
  }

  const body = req.body || {};
  try {
    const result = await callHeadyApi(`/api/v1/nodes/${nodeId}/invoke`, {
      ...body,
      source: 'discord-api',
    });
    return { ok: true, node: node.name, result };
  } catch (err) {
    reply.code(502);
    return { ok: false, error: err.message, node: node.name };
  }
});

// ── Root ──
app.get('/', async () => ({
  service: SERVICE_NAME,
  version: VERSION,
  description: 'Heady Discord Bot — AI-powered community bot with slash commands for 20 AI nodes',
  nodes: AI_NODES.length,
  endpoints: ['/health', '/health/live', '/health/ready', '/bot/status', '/nodes', '/invoke/:nodeId', '/webhook/discord'],
  copyright: '© 2026 HeadySystems Inc. — Eric Haywood, Founder',
}));

// ─── Start ──────────────────────────────────────────────────────────────────

// When required by tests, don't auto-listen — just export the app
if (require.main === module) {
  (async () => {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info({ port: PORT, api: HEADY_API }, `${SERVICE_NAME} operational`);

    // Init Discord client + register commands
    initDiscordClient(app.log);
    await registerCommands(app.log);

    // Graceful shutdown
    const shutdown = async (signal) => {
      app.log.info({ signal }, 'Shutting down...');
      if (discordClient) discordClient.destroy();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })();
}

module.exports = app;
