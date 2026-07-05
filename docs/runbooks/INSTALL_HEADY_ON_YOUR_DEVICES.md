<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  HEADY™ Runbook — Install Heady on Your Devices v1.0.0            ║
<!-- ║  Per-device install paths for the Heady portal: PWA (Android,     ║
<!-- ║  iOS, desktop browser) + native desktop shell (apps/heady-desktop)║
<!-- ║  and the update story for each surface.                           ║
<!-- ║  FILE: docs/runbooks/INSTALL_HEADY_ON_YOUR_DEVICES.md             ║
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                 ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# Install Heady on Your Devices

**What you are installing:** the HeadyMe portal (`apps/headyme-portal`), deployed to Firebase Hosting (project `heady-ai`) and fronted by **https://1ime1.com** (admin surface, currently behind Cloudflare Access) with **https://headyme.com** as the primary user surface (domain canon: `facts.yaml → domains`). The portal is a PWA (service worker + web manifest, delivered by the portal PWA leg); the desktop native shell is `apps/heady-desktop` (Electron).

**Release gate:** every deploy on `main` runs `.github/workflows/deploy-firebase-hosting.yml`, which emits a `release-manifest` artifact (version from `facts.yaml`, dist size, sha256 of `index.html` / `sw.js` / `manifest.webmanifest`) and fail-closed smoke tests of the live manifest, service-worker headers, and app shell. If that workflow is green, the surfaces below are installable.

---

## 1. Android — Chrome install prompt (WebAPK)

1. Open **https://1ime1.com** (or **https://headyme.com** once it fronts the portal) in Chrome.
   - 1ime1.com sits behind Cloudflare Access — complete the email-code sign-in first.
2. Chrome shows an **Install app** entry (⋮ menu → *Add to Home screen → Install*, or an inline install prompt if the engagement heuristics fire).
3. Confirm. Chrome mints a **WebAPK**: real launcher icon, its own task, standalone display (no browser chrome), registered in Android settings like any app.
4. Verify: the app appears under *Settings → Apps* and launches full-screen with the Heady icon.

**Updates:** automatic. The service worker checks for a new build on launch; when one is waiting, the portal shows its update toast — tap it to reload into the new version. The WebAPK shell itself is re-minted by Chrome periodically when the manifest changes.

## 2. iOS / iPadOS — Safari Add to Home Screen

1. Open **https://1ime1.com** in **Safari** (this flow is Safari-only).
2. Tap **Share → Add to Home Screen → Add**.
3. Launch from the new home-screen icon — the portal runs standalone using the manifest's name/icon/theme.

**Honest iOS limits (WebKit, as of iOS 18/26-era WebKit):**
- No install prompt — Add to Home Screen is always manual.
- Push notifications and badging only work for the *installed* (home-screen) instance, not the Safari tab.
- Storage for an installed web app can be evicted by the OS under pressure; long-lived offline state is best-effort.
- Each home-screen install is a separate storage silo — signing in again after install is expected.
- No WebAPK equivalent: the icon is a Safari wrapper, and some hardware APIs available on Android are absent.

**Updates:** same service-worker flow — relaunch the app, the SW fetches the new build, the update toast offers the reload.

## 3. Desktop browser — Chrome/Edge omnibox install

1. Open **https://1ime1.com** in Chrome or Edge.
2. Click the **install icon in the omnibox** (⊕ / monitor-with-arrow, right end of the address bar), or ⋮ menu → *Cast, save and share → Install page as app* (Chrome) / *Apps → Install this site as an app* (Edge).
3. The portal opens in its own window with the Heady icon, taskbar/dock presence, and OS-level app switching.

**Updates:** identical service-worker toast flow; the installed window updates with the web, no reinstall ever.

## 4. Desktop native — the Heady Electron shell (`apps/heady-desktop`)

A hardened native window around the deployed portal: context isolation + sandbox on, renderer gets only `window.headyDesktop = { appVersion, platform }`, external links open in your default browser, single-instance lock, honest offline fallback page with φ-backoff auto-retry. The portal origin comes from `HEADY_PORTAL_URL` (env override) → `facts.yaml`-derived default `https://1ime1.com`.

### Build it (per OS, on that OS)

```bash
pnpm install                              # workspace root — links apps/heady-desktop
pnpm --filter heady-desktop build         # unpacked app (electron-builder --dir) for local verification
pnpm --filter heady-desktop dist          # installers for the OS you are on
```

- **Linux host** → `release/Heady-<version>.AppImage` (chmod +x and run) and `release/heady-desktop_<version>_amd64.deb` (`sudo apt install ./heady-desktop_*.deb`).
- **Windows host** → `release/Heady Setup <version>.exe` (NSIS, per-user or custom dir).
- **macOS host** → `release/Heady-<version>.dmg` (drag to Applications).

Identity (`appId com.headysystems.heady-ai`, product name `Heady`, version) is derived from `facts.yaml` by `scripts/sync-from-facts.mjs` on every dev/build/dist — there is no hardcoded duplicate to drift.

### Founder-gated (not automated, by design)

| Item | Why it is gated |
|---|---|
| Windows code-signing certificate (OV/EV) | Paid org-verified cert; unsigned NSIS installers trip SmartScreen until reputation accrues |
| macOS Developer ID signing + notarization | Requires the Apple Developer account + credentials; unsigned dmg apps are blocked by Gatekeeper without right-click-Open |
| Cross-OS builds | electron-builder packages reliably only on the target OS (mac dmg needs macOS); CI matrix + signing secrets are a founder call |
| Store distribution (Microsoft Store, Mac App Store, Snap/Flathub) | Account creation, review policies, and publishing identity |

**Updates:** the shell intentionally ships **no auto-updater** — it loads the live portal, so every web deploy is instantly the desktop experience too. The Electron binary itself only needs rebuilding for Electron/security upgrades, not for product releases.

## 5. The update story in one table

| Surface | Update mechanism | User action |
|---|---|---|
| Android WebAPK | Service worker + update toast | Tap the toast |
| iOS home-screen app | Service worker + update toast | Relaunch, tap the toast |
| Desktop browser PWA | Service worker + update toast | Tap the toast |
| Heady desktop shell | Loads the live portal — updates with the web | None |
| Shell binary itself | Rebuild `heady-desktop` on Electron upgrades | Install new package |

The `Cache-Control: no-cache` contract on `/sw.js` (enforced by the deploy workflow's smoke test) is what makes every one of these paths pick up new releases immediately instead of pinning users to a stale service worker.
