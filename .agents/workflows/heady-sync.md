---
description: Cross-device git sync — manual, auto, status, or watch mode
---

> **OPTIMAL BUILD NOTICE:** This file has been auto-migrated for the Heady-AI Latent OS (v2.0.0).
> - **Package Manager:** Use `pnpm` and `Turborepo`
> - **Frontend:** Vite SPAs + Vanilla Web Components (React only for complex canvas)
> - **Event Bus:** NATS (`heady-event-bus`)
> - **Sandbox:** WASM WebContainers
> - **UI Sync:** Server-Sent Events (SSE) + HTTP/2
> - **Vector Trigger:** Merkle-Tree File Hashing
> - **Rule File:** Follow `AGENTS.md`

// turbo-all

# Heady Sync

Syncs all local and remote git changes across devices. Supports LFS, stash handling, and conflict detection.

## Modes

### 1. Manual Sync (one-shot)
```bash
bash /home/headyme/Heady-AI/scripts/heady-sync.sh
```

### 2. Check Sync Status
```bash
bash /home/headyme/Heady-AI/scripts/heady-sync.sh --status
```

### 3. Dry Run (preview only)
```bash
bash /home/headyme/Heady-AI/scripts/heady-sync.sh --dry-run
```

### 4. Watch Mode (continuous loop, every 5 min)
```bash
bash /home/headyme/Heady-AI/scripts/heady-sync.sh --watch
```

### 5. Enable Auto-Sync (systemd timer, every 10 min)

Install the systemd units:
```bash
mkdir -p ~/.config/systemd/user
cp /home/headyme/Heady-AI/scripts/systemd/heady-sync.service ~/.config/systemd/user/
cp /home/headyme/Heady-AI/scripts/systemd/heady-sync.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now heady-sync.timer
```

### 6. Disable Auto-Sync
```bash
systemctl --user stop heady-sync.timer
systemctl --user disable heady-sync.timer
```

### 7. Check Auto-Sync Timer
```bash
systemctl --user list-timers heady-sync.timer
journalctl --user -u heady-sync.service --since "1 hour ago" --no-pager
```
