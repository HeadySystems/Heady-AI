<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY™ AutoFlow Provider Receipts                             ║ -->
<!-- ║  IDs, deployment versions, probes, and withheld promotions.    ║ -->
<!-- ║  Made with ❤️ by HeadySystems Inc.              ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# Provider Receipts

## Cloudflare account resources

- Account ID: `8b1fa38f282c691423c6399247d53323`
- D1 `heady_db`: `75ecd31d-2c75-48ab-97d7-f1b10f73effd`, region `ENAM`, verified by a subsequent
  `d1 list` read.
- KV `AI_ROUTING_RULES`: `998b0134e0b24e7682a1b2b0bf4659fd`.
- KV `AI_COST_TRACKER`: `a46c1791fd8247c5987f1ad8e40361b8`.

## Google Drive connector

- Folder: `Heady Sync Fabric`.
- Folder ID: `1S33CLRIveCO14GMGlxkeMltvP5MeOnZ7`.
- URL: `https://drive.google.com/drive/folders/1S33CLRIveCO14GMGlxkeMltvP5MeOnZ7`.
- Verification: exact metadata lookup returned folder MIME type and the exact search returned one
  result; direct child listing returned an empty list.

## Deployed Cloudflare artifacts

| Worker | Source/config hash | Bundle tree hash | Version | Probe |
|---|---|---|---|---|
| `worker-heady-router` | `033537f3…e2f8` / `ddd4f59a…aff8` | `55653dfd…4164` | `f5fd2ca9-6034-4e5f-bb99-4ec1e1e71f52` | workers.dev `/health` `200`; `headymcp.com/health` `200` |
| `headyio-worker` | `d983e239…711a` / `079c85a7…b135` | `ff58c508…564d` | `73148fee-d44b-45c3-b486-731cec179596` | workers.dev `/api/health` `200` |

The router probe confirmed the live origin header
`heady-manager-609590223909.us-central1.run.app`. A public probe of the nominal us-east1 URL
returned `404`, so no speculative origin rewrite was made.

## P2 Firebase artifact

- Project/config target: `heady-ai`, default Hosting site, `apps/headyme-portal/dist`.
- Tests: `2` passed.
- Build: Vite production build completed.
- Tree digest: `95e3f8899f7c7c630f6f9ff6e31c8bffb9a50dfa52ab255d2cb6927cc013f3c5`.
- Critical files: `index.html` `38606df1…e0a7`; `sw.js` `772c8dd8…0000`;
  `manifest.webmanifest` `681e1fae…ef00`.
- Promotion state: `blocked_auth`; local Firebase project discovery returned
  `Failed to authenticate, have you run firebase login?`.

## P3 withheld artifacts

All six declared candidates dry-run bundled successfully after resource binding and dependency
repair. These four were not promoted:

| Worker | Gate |
|---|---|
| `heady-edge-node` | Public mutation surface lacks required auth; locked embedding dimension violated |
| `worker-ai-gateway` | Binding names disagree with runtime code; inbound auth is unused |
| `worker-mcp-telemetry` | Required secret metadata absent |
| `heady-router` | Claims the Firebase-owned `headyme.com/*` and `www.headyme.com/*` routes |
