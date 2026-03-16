---
name: heady-linter-gate
description: Use when implementing linter-gated code editing, syntax validation before applying changes, or quality-enforced agent modifications in the Heady™ ecosystem. Keywords include linter gate, syntax check, ACI, code validation, edit rejection, quality gate, static analysis.
metadata:
  author: HeadySystems
  version: '1.0'
  liquid_node: LiquidACI
  absorption_source: "SWE-Agent Agent-Computer Interface — 10.7% accuracy improvement"
---

# Heady™ Linter Gate (LiquidACI)

## When to Use This Skill

Use this skill when the user needs to:
- Reject agent code edits that introduce syntax errors
- Enforce code quality before changes are applied
- Implement the Agent-Computer Interface pattern for safer editing
- Gate file writes behind static analysis checks

## Instructions

### Edit-Validate-Apply Cycle

```
Agent proposes edit → Linter validates → Pass? → Apply to file
                                           │
                                        Fail? → Return error + diagnostics → Agent retries
```

### Validation Stack

| Language | Linter | Check |
|---|---|---|
| TypeScript | `tsc --noEmit` | Type errors, syntax |
| JavaScript | `eslint --no-eslintrc` | Syntax, basic rules |
| Python | `ruff check` | Syntax, imports, style |
| JSON | `JSON.parse()` | Valid JSON |
| YAML | `yaml.safe_load()` | Valid YAML |
| Markdown | `markdownlint` | Structure, links |

### Implementation

```javascript
async function gatedEdit(filePath, proposedContent, originalContent) {
  // 1. Write proposed content to temp file
  const tempPath = `/tmp/heady-lint-${Date.now()}${path.extname(filePath)}`;
  await fs.writeFile(tempPath, proposedContent);
  
  // 2. Run appropriate linter
  const linter = selectLinter(filePath);
  const result = await linter.check(tempPath);
  
  // 3. Gate decision
  if (result.errors.length > 0) {
    return {
      applied: false,
      errors: result.errors,
      message: `Edit rejected: ${result.errors.length} syntax errors`,
      suggestion: 'Fix errors and retry'
    };
  }
  
  // 4. Apply if clean
  await fs.writeFile(filePath, proposedContent);
  return { applied: true, warnings: result.warnings };
}
```

### Viewport Pattern (100-line window)

- Agent sees ~100 lines of code at a time (not whole files).
- Search commands return succinct summaries, not full matches.
- Forces focused, incremental edits instead of wholesale file rewrites.
- 10.7 percentage points accuracy improvement over bash-only editing.

## Output Format

- Lint Validation Report
- Edit Accept/Reject Decision
- Error Diagnostics
- Retry Suggestions
