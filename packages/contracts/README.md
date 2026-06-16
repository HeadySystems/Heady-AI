# @heady/contracts

The contract surface. **`openapi/heady.openapi.json` (OpenAPI 3.1) is the single source of truth** (ADR-0001); types, Zod schemas, and `mcp-tools.json` derive from it.

```js
import { loadSpec, generateMcpTools, spec } from "@heady/contracts";

const tools = generateMcpTools(spec);   // one MCP tool per operation, with inlined JSON-Schema inputs
// → [{ name: "enqueueTask", method: "POST", path: "/tasks", description, inputSchema }, …]
```

- `generateMcpTools()` — the `OpenAPI → mcp-tools.json` step (pure JS, runs today).
- Type/Zod generation is a build step via **Kubb / `@hey-api/openapi-ts`** once deps install.
- Operations: `getHealth`, `enqueueTask`, `getTask` (extend the spec, not hand-written types).

Pure ESM, zero runtime deps. `pnpm --filter @heady/contracts test`.
