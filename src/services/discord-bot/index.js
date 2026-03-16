/**
 * @fileoverview discord-bot — Discord community bot — HeadyConnection community engagement
 * Full discord.js integration with slash commands for 20 AI nodes.
 *
 * @module discord-bot
 * @version 4.0.0
 * @port 3353
 * @domain interface
 *
 * Heady™ Latent OS — Sacred Geometry v4.0
 * © 2026 HeadySystems Inc. — Eric Haywood, Founder
 * 51 Provisional Patents — All Rights Reserved
 */

'use strict';

const { LiquidNodeBase, CSL_THRESHOLDS, PHI, PSI, PSI2, FIB, fib, phiThreshold, phiBackoff, correlationId } = require('../../shared/liquid-node-base');
const { ServiceMesh, SERVICE_CATALOG, DOMAIN_SWARMS } = require('../../shared/service-mesh');

const mesh = ServiceMesh.instance();

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

class DiscordBot extends LiquidNodeBase {
  constructor() {
    super({
      name: 'discord-bot',
      port: 3353,
      domain: 'interface',
      description: 'Discord community bot — HeadyConnection community engagement with 20 AI node slash commands',
      pool: 'warm',
      dependencies: ['heady-buddy', 'heady-brain', 'heady-gateway'],
    });

    this.discordClient = null;
    this.botConnected = false;
    this.guildCount = 0;
    this.commandsRegistered = false;
    this.botToken = process.env.DISCORD_BOT_TOKEN || '';
    this.clientId = process.env.DISCORD_CLIENT_ID || '';
  }

  async onStart() {
    // GET /bot/status — bot connection status
    this.route('GET', '/bot/status', async (req, res) => {
      this.json(res, 200, {
        connected: this.botConnected,
        guilds: this.guildCount,
        commandsRegistered: this.commandsRegistered,
        nodes: AI_NODES.length,
        note: this.botConnected
          ? `Bot is live in ${this.guildCount} server(s) with ${AI_NODES.length} AI nodes`
          : 'Bot is in scaffold mode — set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID to connect',
      });
    });

    // GET /nodes — list all AI nodes
    this.route('GET', '/nodes', async (req, res) => {
      this.json(res, 200, { count: AI_NODES.length, nodes: AI_NODES });
    });

    // POST /message — handle a Discord message via API
    this.route('POST', '/message', async (req, res, ctx) => {
      const { content, userId, channel } = ctx.body || {};
      if (!content) return this.sendError(res, 400, 'Missing content', 'MISSING_CONTENT');
      this.json(res, 200, {
        reply: `HeadyBot received: ${content.substring(0, fib(10))}`,
        channel,
        processed: true,
      });
    });

    // POST /invoke — invoke an AI node
    this.route('POST', '/invoke', async (req, res, ctx) => {
      const { nodeId, prompt } = ctx.body || {};
      const node = AI_NODES.find(n => n.id === nodeId);
      if (!node) return this.sendError(res, 404, 'Unknown node', 'UNKNOWN_NODE');

      try {
        const result = await this.callService('heady-gateway', `/api/v1/nodes/${nodeId}/invoke`, {
          method: 'POST',
          body: { prompt, source: 'discord-api' },
        });
        this.json(res, 200, { ok: true, node: node.name, result });
      } catch (err) {
        this.log.error(`Node invocation failed: ${err.message}`, { nodeId });
        this.json(res, 502, { ok: false, error: err.message, node: node.name });
      }
    });

    // POST /webhook/discord — Discord interactions webhook
    this.route('POST', '/webhook/discord', async (req, res, ctx) => {
      const body = ctx.body || {};
      if (body.type === 1) {
        return this.json(res, 200, { type: 1 });
      }
      if (body.type === 2) {
        const data = body.data || {};
        return this.json(res, 200, {
          type: 4,
          data: { content: `🧠 Processing /${data.name || 'heady'} via webhook...` },
        });
      }
      this.json(res, 200, { type: 1 });
    });

    // Initialize Discord client if token is available
    this._initDiscord();

    this.log.info('discord-bot initialized with 20 AI nodes');
  }

  _initDiscord() {
    if (!this.botToken || this.botToken === 'test-token-12345') {
      this.log.info('Discord bot in scaffold mode (no valid token)');
      return;
    }

    try {
      const { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } = require('discord.js');

      this.discordClient = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
        ],
      });

      this.discordClient.on(Events.ClientReady, (c) => {
        this.botConnected = true;
        this.guildCount = c.guilds.cache.size;
        this.log.info(`Discord bot connected as ${c.user.tag} in ${this.guildCount} guilds`);
      });

      this.discordClient.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        await this._handleInteraction(interaction);
      });

      this.discordClient.on(Events.Error, (err) => {
        this.log.error(`Discord client error: ${err.message}`);
      });

      this.discordClient.login(this.botToken).catch(err => {
        this.log.error(`Discord login failed: ${err.message}`);
      });

      this.onShutdown('discord-client', async () => {
        if (this.discordClient) this.discordClient.destroy();
      });
    } catch (err) {
      this.log.warn(`discord.js not available: ${err.message} — running in HTTP-only mode`);
    }
  }

  async _handleInteraction(interaction) {
    const { commandName } = interaction;

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
        const result = await this.callService('heady-gateway', `/api/v1/nodes/${node.id}/invoke`, {
          method: 'POST',
          body: { prompt, userId: interaction.user.id, channel: interaction.channelId, source: 'discord' },
        });
        const response = result.response || result.reply || JSON.stringify(result);
        await interaction.editReply(`${node.emoji} **${node.name}**\n\n${String(response).substring(0, 1900)}`);
      } catch (err) {
        this.log.error(`Node invocation failed: ${err.message}`, { node: node.id });
        await interaction.editReply(`⚠️ ${node.name} is temporarily unavailable. Error: ${err.message}`);
      }
    }

    if (commandName === 'heady-status') {
      try {
        const health = await this.callService('heady-gateway', '/api/v1/health');
        await interaction.reply({
          content: `🏥 **Heady System Status**\n\`\`\`json\n${JSON.stringify(health, null, 2).substring(0, 1800)}\n\`\`\``,
        });
      } catch (err) {
        await interaction.reply({ content: `⚠️ Could not reach Heady API: ${err.message}`, ephemeral: true });
      }
    }

    if (commandName === 'heady-nodes') {
      const list = AI_NODES.map(n => `${n.emoji} **${n.name}** — ${n.desc}`).join('\n');
      await interaction.reply({ content: `📋 **20 Heady AI Nodes**\n\n${list}` });
    }
  }
}

new DiscordBot().start();
