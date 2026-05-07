# Heady™ Sovereign Node Deployment Playbook (v3.0)

This playbook outlines the procedure for deploying a sovereign Heady node with active monetization and liquidity settlement.

## 1. Infrastructure Preparation
- **Kubernetes**: Ensure a K8s cluster (v1.28+) is active in a supported region (us-east1, europe-west1, or asia-northeast1).
- **Tailscale**: Install Tailscale and apply the Heady Zero-Trust ACLs from `k8s/security/tailscale-acl.json`.
- **Secrets**: Provision `STRIPE_SECRET_KEY` and `FIREBASE_SERVICE_ACCOUNT` in GCP Secret Manager.

## 2. Core Service Deployment
1. **Apply CRDs**: 
   ```bash
   kubectl apply -f k8s/manifests/crd/headyapp.yaml
   ```
2. **Deploy Operator**: 
   ```bash
   kubectl apply -f k8s/manifests/operator/heady-operator.yaml
   ```
3. **Provision Nodes**:
   Run the multi-region deployment script:
   ```bash
   node scripts/deployment/deploy-multi-region.mjs
   kubectl apply -f k8s/manifests/liquid-nodes/
   ```

## 3. Monetization Activation
1. **Stripe Onboarding**: Generate an Express account link for the node operator via the `billing-service`.
2. **SalesBee Initialization**: Activate the SalesBee outreach swarm to begin lead enrichment.
3. **HDC Ledger Sync**: Verify the `hdc-ledger.json` is correctly buffered and synced across nodes.

## 4. Health Gating & Resiliency
- Verify circuit breakers in `stripe.js` by running a simulated API failure test.
- Run `RedTeamBee` to verify compute-limit enforcement.

## 5. Monitoring
- Access the **SalesBee Dashboard** at `http://<node-ip>/sales-bee/`.
- Monitor voting power and governance participation via the `/api/monetization/trust` endpoint.

---
© 2026 HeadySystems Inc. — Sovereign Intelligence Infrastructure
