# Heady Repository Archive Candidates

**Audited:** 2026-03-17 · **Auditor:** HeadyBuilder Maintenance System

## Critical — Remove from Git History (use BFG or git filter-repo)

### AndroidSDK/ (28,145 files, multi-GB)
- **Action:** Remove from repo. Add to `.gitignore`. Download via CI/CD pipeline or developer setup script.
- **Reason:** Binary SDK files should never be in git. Bloats clone size enormously.

### Root-level binaries and archives
| File | Size | Action | Reason |
|------|------|--------|--------|
| `cloudflared.exe` | ~50MB | Remove | Binary, install via package manager |
| `cmake.zip` | ~45MB | Remove | Install via package manager |
| `nasm.zip` | ~3MB | Remove | Install via package manager |
| `ventoy.zip` | ~15MB | Remove | Not relevant to codebase |
| `gradle-8.5-bin.zip` | ~120MB | Remove | Install via wrapper |
| `platform-tools.zip` | ~10MB | Remove | Part of Android SDK setup |
| `Heady_Deployment_Max.zip` | Variable | Remove | Build artifact, regenerate from source |
| `Heady_Deployment_OS.zip` | Variable | Remove | Build artifact, regenerate from source |
| `headybrowser-desktop/src/designs/v2/design_8015.exe` | Unknown | Remove | Binary in source tree |

## Medium — Move to _archive or delete

### Stale root-level files
| File | Action | Reason |
|------|--------|--------|
| `DriveSync.ps1` | Archive | One-time sync script |
| `drive_sync_log_20260209_212004.txt` | Delete | Log file |
| `hc.bat` | Archive | Legacy batch launcher |
| `heady.bat` | Archive | Legacy batch launcher |
| `hc_pipeline.log` | Delete | Log file |
| `files.txt` | Delete | Generated file list |
| `files_with_localstorage.txt` | Delete | Audit artifact |
| `files_with_todo.txt` | Delete | Audit artifact |
| `deploymentId.txt` | Delete | Deployment artifact |
| `deployment-complete.txt` | Delete | Deployment artifact |
| `deployment-results.json` | Delete | Deployment artifact |
| `deployment-status.md` | Archive | Reference |
| `deployment-status.txt` | Delete | Deployment artifact |
| `deployment-verified.txt` | Delete | Deployment artifact |
| `system-fully-operational.txt` | Delete | Status artifact |
| `system-operational.txt` | Delete | Status artifact |
| `secret-service-deployed.txt` | Delete | Deployment artifact |
| `cloudflare-deployed.txt` | Delete | Deployment artifact |

### Old super prompts (keep only v8)
| File | Action |
|------|--------|
| `HEADY_SUPER_PROMPT.md` | Archive (original) |
| `HEADY_SUPER_PROMPT_v5.md` | Archive |
| `HEADY_SUPER_PROMPT_v6.md` | Archive |
| `HEADY_SUPER_PROMPT_v6_AMP.md` | Archive |
| `HEADY_SUPER_PROMPT_v7.md` | Archive |
| `HEADY_SUPER_PROMPT_v7_AMP.md` | Archive |
| `HEADY_SUPER_PROMPT_v7_OMEGA.md` | Archive |
| `HEADY_SUPER_PROMPT_v7_liquid_lattice_omega.md` | Archive |
| `.agents/context/HEADY_SUPER_PROMPT_v5.md` | Update to v8 |
| `.claude/HEADY_SUPER_PROMPT_v5.md` | Update to v8 |
| `.gemini/HEADY_SUPER_PROMPT_v5.md` | Update to v8 |
| `.windsurf/HEADY_SUPER_PROMPT_v5.md` | Update to v8 |

### Root fix scripts (one-time fixes, already applied)
| File | Action | Reason |
|------|--------|--------|
| `fix_backend.sh` | Delete | Fix already applied |
| `fix_cookies.js` | Delete | Fix already applied (localStorage → httpOnly) |
| `fix_dc2.py` | Delete | Fix already applied |
| `fix_eric_head.sh` | Delete | Fix already applied |
| `fix_issues.sh` | Delete | Fix already applied |
| `fix_manager.js` | Delete | Fix already applied |
| `fix_owasp.js` | Delete | Fix already applied |
| `fix_python_priority.py` | Delete | Fix already applied |

### .bfg-report/ directory
- **Action:** Delete. This is a BFG Repo-Cleaner output from a previous clean.

## Low — Review and consolidate

### Duplicate/overlapping directories
- `heady-ide/` and `HeadyAI-IDE/` and `apps/headyweb/remotes/heady-ide/` — Consolidate into HeadyAI-IDE as single source of truth
- `heady-buddy/` and `apps/headyweb/remotes/buddy/` — Consolidate
- Multiple docker-compose files at root — Consolidate into single `docker-compose.yml` with profiles

### Old documentation
- `00-HEADY-FULL-REBUILD-PROMPT.md`, `00-THIS-PROMPT.md`, `00-THIS-PROMPT.v4.md` — Archive build prompts
- Numbered markdown files at root (01-* through 09-*) — Move to `docs/architecture/`
