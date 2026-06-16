# HeadyMe Portal Specification (PPA-35)
Domain: `headyme-portal`
Target Surface: Web (Vite SPA + Vanilla Web Components)

## 1. Architectural Mandates
- **Framework:** Vanilla JS + Vite. Zero heavy frameworks like React, Vue, or Angular.
- **Routing:** Client-side hash routing or history API for `#onboarding` and `#admin`.
- **Styling:** Vanilla CSS utilizing Sacred Geometry design tokens (φ-scaled padding, glassmorphism UI).
- **Authentication:** Firebase Auth (`email/password` initial support).
  <!-- @research-query "Firebase Auth multiple providers OAuth best practices 2026" -->
<!-- @research-results "Firebase Auth multiple providers OAuth best practices 2026" -->
> **Live Research Citation: Firebase Auth multiple providers OAuth best practices 2026**
> 
> *Summary:* Standardizing cross-domain SSO via a dedicated subdomain (auth.headysystems.com) prevents cookie partitioning issues in modern browsers (Chrome Privacy Sandbox/Safari ITP). Standard callback flows must use POST redirect gates rather than client-side fragments to secure JWT tokens.
> 
> *Citations:*
> - [Google Firebase Auth Documentation](https://firebase.google.com/docs/auth) — verified 2026-01-15
> - [W3C Federated Credential Management API (FedCM)](https://w3c.github.io/fedcm) — verified 2026-03-02
<!-- @research-results-end -->
- **Deployment:** Firebase Hosting via `firebase.json` mapped to `heady-ai`.

## 2. Component Structure
- `src/main.js`: Bootstrapper and route coordinator.
- `src/services/firebase.js`: Initializes Firebase app and exports auth instances.
- `src/components/OnboardingUI.js`: Renders the login/signup glassmorphism panel.
- `src/components/AdminUI.js`: Renders the protected control plane dashboard.
- `src/style.css`: Sacred geometry CSS variables (`--phi: 1.618`), dark mode gradients.

## 3. Interaction Flow
1. User lands on `/`.
2. Router checks Firebase `onAuthStateChanged`.
3. If unauthenticated → Render `OnboardingUI.js`.
4. User enters credentials → calls `signInWithEmailAndPassword` or `createUserWithEmailAndPassword`.
5. Upon success → state changes, router redirects to `#admin`.
6. If authenticated → Render `AdminUI.js` displaying a dashboard of Heady system status and permissions.

## 4. Antigravity Event Emitters
- Emitters will broadcast `auth:login:success`, `auth:logout`, and `navigation:admin:entered` to the window so parent Heady containers (if framed) can react.
