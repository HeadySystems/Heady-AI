// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Agent-Onboarding enforcer tests — the front door is real ║
// ║  Proves: front-door reference detection, malformed settings flag, ║
// ║  per-event hook extraction, brand-header + SessionStart-contract   ║
// ║  checks accept good input and reject bad. © 2026 HeadySystems Inc. ║
// ╚══════════════════════════════════════════════════════════════════╝
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  referencesFrontDoor, parseSettings, extractHookFiles, hasBrandHeader, isSessionStartContract,
} from '../agent-onboarding.mjs';

test('referencesFrontDoor detects the link and its absence', () => {
  assert.equal(referencesFrontDoor('see [START_HERE.md](./START_HERE.md) first'), true);
  assert.equal(referencesFrontDoor('Read AGENTS.md and CLAUDE_MEMORY.md.'), false);
});

test('parseSettings FLAGS malformed JSON and ACCEPTS valid JSON', () => {
  assert.equal(parseSettings('{ "a": 1, }').ok, false); // trailing comma — invalid
  const ok = parseSettings('{ "autoCompactWindow": 1000000 }');
  assert.equal(ok.ok, true);
  assert.equal(ok.settings.autoCompactWindow, 1000000);
});

test('extractHookFiles pulls every referenced hook with its event', () => {
  const settings = {
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/heady-session-context.mjs"' }] }],
      PreToolUse: [{ matcher: 'Edit|Write', hooks: [
        { type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/heady-rules.mjs"' },
        { type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/skeleton-guard-hook.mjs"' },
      ] }],
    },
  };
  const refs = extractHookFiles(settings);
  assert.equal(refs.length, 3);
  assert.deepEqual(refs.filter((r) => r.event === 'SessionStart').map((r) => r.file), ['heady-session-context.mjs']);
  assert.ok(refs.some((r) => r.event === 'PreToolUse' && r.file === 'skeleton-guard-hook.mjs'));
});

test('extractHookFiles tolerates an empty / hookless config', () => {
  assert.deepEqual(extractHookFiles({}), []);
  assert.deepEqual(extractHookFiles({ hooks: { Stop: [] } }), []);
});

test('hasBrandHeader requires HEADY near the top of the file', () => {
  assert.equal(hasBrandHeader('// HEADY™ Module v1.0.0\nexport const x = 1;'), true);
  assert.equal(hasBrandHeader(`${'x'.repeat(700)}// HEADY past the header window`), false);
  assert.equal(hasBrandHeader('export const x = 1;'), false);
});

test('isSessionStartContract accepts the contract and rejects everything else', () => {
  assert.equal(isSessionStartContract(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'x' } })), true);
  assert.equal(isSessionStartContract(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse' } })), false);
  assert.equal(isSessionStartContract('not json at all'), false);
  assert.equal(isSessionStartContract(''), false);
});
