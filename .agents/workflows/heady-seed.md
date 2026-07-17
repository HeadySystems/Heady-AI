# heady-seed

**Command:** `/heady-seed`
**Description:** Initialize and bootstrap the Heady environment, specifically provisioning the Google Antigravity Python SDK worker bridge and injecting default vectors into Neon databases.

## Trigger Conditions
- Run on completely fresh workspace clones.
- Run when transitioning to new AI models/runtimes (like adopting Google Antigravity capabilities).
- Run when the `python/` execution layer is wiped or corrupted.

## Workflow Pipeline
1. **Dependency Sync:**
   - Detects if `uv` (Python fast package manager) is installed.
   - Runs `export PATH="$HOME/.local/bin:$PATH" && uv sync` in the `python/` directory.
2. **Environment Hydration:**
   - Verifies that `NATS_URL`, `DATABASE_URL`, and `GEMINI_API_KEY` exist in the `.env` file.
3. **Bootstrapping Latent Service:**
   - Launches the `python/src/worker.py` in the background (or registers it with PM2).
   - Polls the Node.js bridge (`src/services/heady-antigravity-bridge.js`) until it confirms `UP` status.
4. **Vector Injection (Future Scope):**
   - Hydrates `pgvector` with standard `Heady` baseline spatial embeddings for RAM-First ops.

## Success Criteria
- The Antigravity NATS worker accepts and successfully returns a response to the prompt: `"System Check: Are you alive?"`.
