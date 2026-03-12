# Heady SSH Key & Token Inventory
> Last updated: 2026-03-11

## SSH Keys

### HeadyMe (headyme@headyme.com)

| File | Fingerprint | Used For |
|------|-------------|----------|
| `~/.ssh/id_ed25519` | `SHA256:E1aeUArFWLq9UNLcI/hSua/KYrqqOk6IbcNWvH1Nm7c` | GitHub (HeadyMe), default SSH |

### HeadyConnection (headyconnection@headyconnection.org)

| File | Fingerprint | Used For |
|------|-------------|----------|
| `~/.ssh/id_ed25519_headyconnection` | `SHA256:xsXy6u+IIHSwr+6aj6NbWYj6wlnMx9MjJTKjsFA3tjU` | GitHub (HeadyConnection/HeadyAI) — **registered** |
| `~/.ssh/id_ed25519_headyconnection_new` | `SHA256:P4QjUF1LJ4SL5auW2aHYoKrtW2OV7XFsQ1Lk6kYJLKM` | Loaded in agent, not registered |
| `~/.ssh/id_ed25519_headyconnection_2026` | `SHA256:v3urGC8sePFDieFgjsNCB4obYHGTnDWbSHsKKFy8sfY` | Loaded in agent, not registered |
| `~/.ssh/id_ed25519_headyconnection_feb2026` | `SHA256:zOo2UzfsKAlx84OPzIV9K+QwziWxWXiu9pWx51LmFBM` | Loaded in agent, not registered |
| `~/.ssh/id_ed25519_headyconnection_unique` | `SHA256:MLJqOpZ/6mNxcMNFPtRK6ejNcQZzqRROtUj1wGDMwCg` | Loaded in agent, not registered |
| `~/.ssh/id_ed25519_headyconnection_1771457881` | `SHA256:QHIrKhr/jTvGaqyuAzHeSGSRRa3mA6DlGgxuOmyewuA` | Loaded in agent, not registered |

## SSH Config (`~/.ssh/config`)

| Host Alias | Maps To | Identity | Account |
|------------|---------|----------|---------|
| `github.com` | github.com | auto-select | HeadyMe |
| `github-headyconnection` | github.com | `id_ed25519_headyconnection` | HeadyConnection |

## GitHub PATs

| Type | Prefix | Account | Scopes | Status |
|------|--------|---------|--------|--------|
| Fine-grained | `github_pat_11B3ZL2FQ0...` | HeadyConnection | repo, read:org | ⚠️ Exposed — rotate |
| Classic | `ghp_7qqIJo4ZBL...` | HeadyConnection | admin:org, repo, workflow, + all | ⚠️ Exposed — rotate |
| OAuth (gh CLI) | `gho_****` | HeadyMe | gist, read:org, repo | Active (keyring) |

## Git Remote → Account Mapping

| Remote | URL | Authenticates As |
|--------|-----|-------------------|
| `headyai` | `git@github-headyconnection:HeadyAI/Heady.git` | HeadyConnection (SSH) |
| `headyai-staging` | `git@github.com:HeadyAI/Heady-Staging.git` | HeadyMe (SSH) |
| `headyai-testing` | `git@github.com:HeadyAI/Heady-Testing.git` | HeadyMe (SSH) |
| `hc-main` | `git@github.com:HeadyConnection/Heady-Main.git` | HeadyMe (SSH) |
| `hs-main` | `git@github.com:HeadySystems/Heady-Main.git` | HeadyMe (SSH) |
| `production` | `git@github.com:HeadyMe/heady-production.git` | HeadyMe (SSH) |
