---
name: heady-mcp-server-development
description: Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools
---

# MCP Server Development Guide

## Overview

Create MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. The quality of an MCP server is measured by how well it enables LLMs to accomplish real-world tasks.

---

## Phase 1: Deep Research and Planning

### 1.1 Modern MCP Design Principles

| Principle | Description |
|---|---|
| **API Coverage vs. Workflow Tools** | Balance comprehensive endpoint coverage with specialized workflow tools. When uncertain, prioritize comprehensive API coverage. |
| **Tool Naming & Discoverability** | Use consistent prefixes and action-oriented naming (e.g., `github_create_issue`, `github_list_repos`). |
| **Context Management** | Concise tool descriptions, filter/paginate results, return focused data. |
| **Actionable Error Messages** | Guide agents toward solutions with specific suggestions and next steps. |

### 1.2 MCP Protocol Documentation

- **Sitemap**: `https://modelcontextprotocol.io/sitemap.xml`
- **Spec pages**: Append `.md` for markdown (e.g., `https://modelcontextprotocol.io/specification/draft.md`)
- Review: specification overview, transport mechanisms (streamable HTTP, stdio), tool/resource/prompt definitions.

### 1.3 Framework Documentation

**Recommended stack**: TypeScript + Streamable HTTP (remote) or stdio (local).

| Resource | URL |
|---|---|
| TypeScript SDK | `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md` |
| Python SDK | `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md` |

### 1.4 Plan Your Implementation

- Review the service's API documentation (endpoints, auth, data models).
- List endpoints to implement, starting with the most common operations.

---

## Phase 2: Implementation

### 2.1 Project Structure

Refer to language-specific guides (TypeScript or Python) for project setup, `package.json`/`tsconfig.json`, or module organization.

### 2.2 Core Infrastructure

Create shared utilities:
- API client with authentication
- Error handling helpers
- Response formatting (JSON/Markdown)
- Pagination support

### 2.3 Tool Implementation Checklist

For each tool:

#### Input Schema
- Use **Zod** (TypeScript) or **Pydantic** (Python)
- Include constraints and clear descriptions
- Add examples in field descriptions

#### Output Schema
- Define `outputSchema` where possible
- Use `structuredContent` in tool responses
- Helps clients understand and process outputs

#### Tool Description
- Concise summary of functionality
- Parameter descriptions
- Return type schema

#### Implementation
- Async/await for I/O operations
- Proper error handling with actionable messages
- Support pagination where applicable
- Return both text content and structured data

#### Annotations
```json
{
  "readOnlyHint": true,
  "destructiveHint": false,
  "idempotentHint": true,
  "openWorldHint": false
}
```

---

## Phase 3: Review and Test

### 3.1 Code Quality

- No duplicated code (DRY principle)
- Consistent error handling
- Full type coverage
- Clear tool descriptions

### 3.2 Build and Test

| Language | Build | Test |
|---|---|---|
| TypeScript | `npm run build` | `npx @modelcontextprotocol/inspector` |
| Python | `python -m py_compile your_server.py` | MCP Inspector |

---

## Phase 4: Evaluations

### 4.1 Purpose

Test whether LLMs can effectively use your MCP server to answer realistic, complex questions.

### 4.2 Create 10 Evaluation Questions

1. **Tool Inspection** — List available tools and understand capabilities
2. **Content Exploration** — Use READ-ONLY operations to explore data
3. **Question Generation** — Create 10 complex, realistic questions
4. **Answer Verification** — Solve each question yourself

### 4.3 Evaluation Requirements

Each question must be: **Independent**, **Read-only**, **Complex**, **Realistic**, **Verifiable**, **Stable**.

### 4.4 Output Format

```xml
<evaluation>
  <qa_pair>
    <question>Your complex question here</question>
    <answer>Expected answer</answer>
  </qa_pair>
  <!-- More qa_pairs... -->
</evaluation>
```

---

## Heady Integration Notes

When building MCP servers for the Heady ecosystem:

- Leverage `heady-mcp-gateway-zero-trust` skill for secure gateway patterns
- Coordinate with `heady-connector-vault` for credential management
- Use the existing services infrastructure (`services/`) as integration targets
- Deploy via Cloud Run using the established CI/CD pipeline (`.github/workflows/`)
- Follow `configs/CONFIG_STANDARDS.md` for configuration patterns
