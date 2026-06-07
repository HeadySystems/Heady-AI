#!/usr/bin/env node
// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: scripts/setup-sentry-alerts.js                                                    ║
// ║  LAYER: automation                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

const SENTRY_ORG = process.env.SENTRY_ORG || 'heady-ai';
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const WEBHOOK_URL = process.env.SENTRY_WEBHOOK_URL || '';

if (!SENTRY_AUTH_TOKEN) {
  console.error('ERROR: SENTRY_AUTH_TOKEN is required');
  process.exit(1);
}

const BASE_URL = `https://sentry.io/api/0/organizations/${SENTRY_ORG}`;

async function sentryFetch(path, method = 'GET', body) {
  const resp = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${SENTRY_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sentry API ${method} ${path} → ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

async function getProjects() {
  const projects = await sentryFetch('/projects/');
  return projects.filter(p => !p.isPublic || p.status === 'active');
}

async function getAlertRules(projectSlug) {
  return sentryFetch(`/projects/${SENTRY_ORG}/${projectSlug}/rules/`);
}

async function createAlertRule(projectSlug, rule) {
  return sentryFetch(`/projects/${SENTRY_ORG}/${projectSlug}/rules/`, 'POST', rule);
}

// Standard alert rule templates
function buildAlertRules(projectSlug) {
  const emailAction = {
    id: 'sentry.mail.actions.NotifyEmailAction',
    targetType: 'IssueOwners',
    fallthroughType: 'ActiveMembers',
  };

  const webhookAction = WEBHOOK_URL ? {
    id: 'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',
    service: 'webhooks',
    url: `${WEBHOOK_URL}`,
  } : null;

  const actions = webhookAction ? [emailAction, webhookAction] : [emailAction];

  return [
    {
      name: 'New Issue Alert',
      actionMatch: 'all',
      filterMatch: 'all',
      conditions: [
        { id: 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition' },
      ],
      filters: [],
      actions,
      frequency: 30,
    },
    {
      name: 'Issue Regression Alert',
      actionMatch: 'all',
      filterMatch: 'all',
      conditions: [
        { id: 'sentry.rules.conditions.regression_event.RegressionEventCondition' },
      ],
      filters: [],
      actions,
      frequency: 30,
    },
    {
      // phi-scaled: 8 events in 5 min (fibonacci: 8=FIB[6], 5 min = 300s)
      name: 'Error Spike Alert (8 events / 5 min)',
      actionMatch: 'all',
      filterMatch: 'all',
      conditions: [
        {
          id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
          value: 8,
          comparisonType: 'count',
          comparisonInterval: '5m',
          interval: '5m',
        },
      ],
      filters: [],
      actions,
      frequency: 60,
    },
  ];
}

async function setupProject(project) {
  const projectSlug = project.slug;
  console.log(`\n─── ${projectSlug} ───`);

  let existing;
  try {
    existing = await getAlertRules(projectSlug);
  } catch (err) {
    console.log(`  SKIP: ${err.message}`);
    return;
  }

  const existingNames = new Set(existing.map(r => r.name));
  const rules = buildAlertRules(projectSlug);

  for (const rule of rules) {
    if (existingNames.has(rule.name)) {
      console.log(`  EXISTS: ${rule.name}`);
      continue;
    }
    try {
      const created = await createAlertRule(projectSlug, rule);
      console.log(`  CREATED: ${rule.name} (id=${created.id})`);
    } catch (err) {
      console.log(`  ERROR creating "${rule.name}": ${err.message}`);
    }
  }
}

async function main() {
  console.log(`Setting up Sentry alert rules for org: ${SENTRY_ORG}`);
  console.log(`Webhook URL: ${WEBHOOK_URL || '(none configured)'}\n`);

  const projects = await getProjects();
  console.log(`Found ${projects.length} projects: ${projects.map(p => p.slug).join(', ')}`);

  for (const project of projects) {
    await setupProject(project);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
