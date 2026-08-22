<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  HEADY™ Private NATS Runtime Record v1.0.0                    ║ -->
<!-- ║  Reproducible topology, supply-chain pins, and live receipts.  ║ -->
<!-- ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder             ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# Private NATS Runtime

## Scope and authority

This lane provisions NATS Core as the best-effort, in-flight transport authorized by accepted
ADR-0020. Neon outbox rows remain the durable authority. The lane does not apply protected database
migrations, merge an application pull request, create a founder signature, or substitute automated
checks for independent human review.

The operator authorized the persistent private service on 2026-08-22. The application release remains
bound to its separate exact-digest review artifact.

## Canonical topology

| Resource | Canonical value |
|---|---|
| Project / region / zone | `heady-ai` / `us-east1` / `us-east1-b` |
| VPC / subnet | `heady-private-runtime` / `heady-private-runtime-us-east1` |
| Subnet range | `10.34.0.0/24` (34 is Fibonacci-derived) |
| Broker address / VM | `heady-nats-core-ip` / `heady-event-bus` |
| Broker target tag | `heady-nats-server` |
| Authorized client tag | `heady-nats-client` |
| Client port | TLS NATS Core on TCP `4222` |
| Broker identity | `heady-nats-runtime@heady-ai.iam.gserviceaccount.com` |
| Probe identity / job | `heady-nats-probe@heady-ai.iam.gserviceaccount.com` / `heady-nats-probe` |
| Bootstrap bucket | `heady-ai-nats-bootstrap-us-east1` with uniform access and public-access prevention |
| Server package | `nats-server-v2.14.3-amd64.deb` |
| Server package SHA-256 | `e0c053fc2abe991f17b2be794897bb3f94ca1857bf886498c741ba69fb62522a` |
| Probe base image | `docker.io/library/node@sha256:7aa86fa052f6e4b101557ccb56717cb4311be1334381f526fe013418fe157384` |

The dedicated VPC has no broad internal allow rule and no SSH/RDP ingress. The only application
ingress is TCP `4222` from revisions or jobs carrying `heady-nats-client` to the VM carrying
`heady-nats-server`. Cloud Run uses Direct VPC egress with `private-ranges-only`.

## Secret bindings

Secret values never enter Git, command arguments, logs, or this record.

| Secret Manager ID | Consumer |
|---|---|
| `NATS_SERVERS` | governed application revision and probe job |
| `NATS_TOKEN` | broker VM, governed application revision, and probe job |
| `NATS_CA_CERT` | governed application revision and probe job |
| `NATS_TLS_SERVER_CERT` | broker VM only |
| `NATS_TLS_SERVER_KEY` | broker VM only |

The broker identity receives `roles/secretmanager.secretAccessor` only on its token and server TLS
material, plus object-viewer access only to the pinned bootstrap bucket. The probe identity receives
secret access only to `NATS_SERVERS`, `NATS_TOKEN`, and `NATS_CA_CERT`.

For the Node application revision, mount `NATS_CA_CERT` at `/var/run/secrets/nats/ca.pem`, set
`NODE_EXTRA_CA_CERTS` to that path, inject `NATS_SERVERS` and `NATS_TOKEN` from Secret Manager, and
attach Direct VPC egress plus the `heady-nats-client` network tag. Those revision changes are staged
until the independent application-release gate is satisfied.

## Verification contract

The `heady-nats-probe` job must produce structured records for all of these checks:

1. the private certificate chain and IP subject-alternative-name validate;
2. a modified token is rejected;
3. two independent TLS clients complete publish and subscribe;
4. a broker reset is observed as a disconnect;
5. the client reconnects with phi-scaled backoff and completes a second publish/subscribe cycle.

The live receipt below is updated only from observed provider state and contains no secret value.

## Live receipt

Provisioning and runtime verification are pending in this branch revision.
