---
name: heady-g-bundle
description: Generates a Genesis Bundle (full architectural and OS brain dump) mapped to a date-stamped folder, optimized for seeding a completely new NotebookLM notebook.
---

# /heady-g-bundle — Genesis Bundle Generation Workflow

This workflow is triggered when the user types `/heady-g-bundle`. It is designed to compile the absolute maximum context dump of the Heady ecosystem into a single directory, generating a perfect seed for a new NotebookLM notebook or a new external LLM context window.

## Execution Steps

### 1. Create Date-Stamped Directory
Create a new directory to house the bundle. The folder name must use the current date and time to ensure a chronological archive of all Genesis Bundles.

- **Location:** `docs/genesis-bundles/`
- **Format:** `docs/genesis-bundles/YYYY-MM-DD_HH-MM-SS/`

### 2. Run Deep Scan (Context Mapping)
Execute a deep scan or repository map of the workspace. You need to map the structural layout of the microservices, 3D vector memory components, and the core ecosystem.

- Generate a high-level `repo_map.md` and save it to the new directory.

### 3. Compile the Constitutional Documents
Read the core constitutional and architectural rules that govern the Latent OS. 
Concatenate or copy the following files into the directory (or into a single massive `Heady_NotebookLM_Seed.md` file inside the directory):
- `AGENTS.md`
- `SOURCE_OF_TRUTH.md`
- `CLAUDE_PROJECT_INSTRUCTIONS.md`
- `facts.yaml`

### 4. Synthesize the Genesis File
Create `Heady_NotebookLM_Seed.md` inside the date-stamped folder. 

**Structure of the Seed File:**
1. **Title:** `Heady Latent OS Genesis Bundle - [DATE]`
2. **System Constitution:** Embed the contents of the constitutional documents.
3. **Architecture Map:** Embed the `repo_map.md` output.
4. **Current State:** A brief 2-paragraph summary of what the system is currently focused on.

### 5. Final Output
Once the folder and files are created, notify the user. 
Provide a clickable path to the `Heady_NotebookLM_Seed.md` file so they can easily upload it to NotebookLM.
