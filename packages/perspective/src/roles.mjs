// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Perspective — Roles (RolePort) v1.0.0                     ║
// ║  The "optimal software company" as weighted roles: the 8 cognitive ║
// ║  agents + bee workers + skills, each with competencies + a base     ║
// ║  perspective weight. Derived from HeadyRegistry (no hand-authoring).║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
// ╚══════════════════════════════════════════════════════════════════╝
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('../../..', import.meta.url).pathname);
// Base perspective weight by role kind — agents lead, bees execute, skills advise.
const KIND_WEIGHT = { agent: 0.9, bee: 0.7, skill: 0.6 };
const STOP = new Set(['the', 'and', 'for', 'with', 'a', 'an', 'of', 'to', 'in', 'on', 'use', 'when', 'via', 'that', 'this', 'its', 'per', 'into', 'across', 'every', 'all', 'or', 'is', 'are', 'as', 'by', 'be']);

export function tokenize(text) {
  return [...new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)))];
}

function yamlScalar(value) {
  const scalar = value.trim();
  if (scalar.startsWith('"') && scalar.endsWith('"')) return JSON.parse(scalar);
  if (scalar.startsWith("'") && scalar.endsWith("'")) return scalar.slice(1, -1).replace(/''/g, "'");
  return scalar;
}

function lexiconRoleVars(text) {
  const vars = [];
  let section = null;
  for (const line of text.split('\n')) {
    const heading = line.match(/^(agents|bees):\s*$/);
    if (heading) {
      section = heading[1];
      continue;
    }
    if (/^\S/.test(line)) section = null;
    if (!section) continue;
    const entry = line.match(/^  ([A-Za-z0-9-]+):\s*(.+)$/);
    if (!entry) continue;
    const roleClass = section === 'agents' ? 'agent' : 'bee';
    vars.push({
      class: roleClass,
      name: entry[1],
      def: yamlScalar(entry[2]),
      sot: roleClass === 'agent' ? 'heady-agent-orchestration' : 'heady-bee-swarm-ops',
    });
  }
  return vars;
}

function skillDescription(text) {
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^description:\s*(.*)$/);
    if (!match) continue;
    const inline = match[1].trim();
    if (inline && !['>', '|', '>-', '|-'].includes(inline)) return yamlScalar(inline);
    const parts = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (/^\S/.test(lines[cursor]) && /^[A-Za-z0-9_-]+:/.test(lines[cursor])) break;
      parts.push(lines[cursor].trim());
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  return '';
}

function deriveRoleVars(sourceRoot) {
  const vars = lexiconRoleVars(readFileSync(join(sourceRoot, 'lexicon.yaml'), 'utf8'));
  const skillsRoot = join(sourceRoot, '.agents', 'skills');
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const skillPath = join(skillsRoot, entry.name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    vars.push({
      class: 'skill',
      name: entry.name,
      def: skillDescription(readFileSync(skillPath, 'utf8')),
      sot: `.agents/skills/${entry.name}/SKILL.md`,
    });
  }
  return vars;
}

/** Load roles from the variable-registry (classes agent/bee/skill). Every defined role weighs in. */
export function loadRoles({ registryPath, sourceRoot = ROOT, vars } = {}) {
  const defaultRegistryPath = join(sourceRoot, '.data', 'coherence', 'variable-registry.json');
  const resolvedRegistryPath = registryPath || defaultRegistryPath;
  const list = vars || (existsSync(resolvedRegistryPath)
    ? JSON.parse(readFileSync(resolvedRegistryPath, 'utf8')).vars
    : deriveRoleVars(sourceRoot));
  if (!Array.isArray(list)) throw new TypeError('perspective role registry must contain a vars array');
  return list
    .filter((v) => KIND_WEIGHT[v.class] != null)
    .map((v) => ({ id: v.name, kind: v.class, weight: KIND_WEIGHT[v.class], competencies: tokenize(`${v.name} ${v.def || ''}`), sot: v.sot }))
    .sort((a, b) => a.id.localeCompare(b.id)); // deterministic order
}
