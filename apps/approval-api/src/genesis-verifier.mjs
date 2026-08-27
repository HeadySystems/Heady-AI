// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Read-Only Genesis Verifier v1.0.0                      ║
// ║  Offline signatures, Neon rows, replay, and runtime denial.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import pg from "pg";
import {
  ACCEPTED_ADR_0031,
  canonicalize,
  createPolicyEvaluator,
  publicJwkFingerprint,
  replayApprovalHistory,
  safeHashEqual,
  sha256,
} from "@heady/approvals";
import { createPgDatabase } from "./database.mjs";
import {
  GENESIS_TARGET,
  GENESIS_ZONE_PATHS,
} from "./genesis-contract.mjs";
import { verifyNeonTarget } from "./genesis-target.mjs";

const MIGRATION_VERSION = "0004_approval_control_plane.sql";

async function rollbackAndThrow(client, originalError) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    throw new AggregateError(
      [originalError, rollbackError],
      "read-only genesis verification failed and rollback also failed",
    );
  }
  throw originalError;
}

function assertEqualCanonical(actual, expected, label) {
  if (canonicalize(actual) !== canonicalize(expected)) {
    throw new TypeError(`${label} differs from the authorized genesis artifacts`);
  }
}

function assertBootstrapRows({
  artifacts,
  bootstrap,
  approval,
  events,
  receipts,
  principals,
  receiptKeys,
  outbox,
  auditReplays,
  migration,
  globalGenesisEventCount,
}) {
  if (
    !bootstrap
    || bootstrap.accepted_commit_sha !== ACCEPTED_ADR_0031.acceptedCommit
    || bootstrap.accepted_tag !== ACCEPTED_ADR_0031.tag
    || bootstrap.accepted_tag_object_sha !== ACCEPTED_ADR_0031.tagObject
    || bootstrap.accepted_signer_fingerprint !== ACCEPTED_ADR_0031.signerFingerprint
    || !safeHashEqual(bootstrap.genesis_manifest_sha256, artifacts.manifestSha256)
    || !safeHashEqual(
      bootstrap.migration_sha256,
      artifacts.manifest.implementation.migrationSha256,
    )
    || bootstrap.deployment_artifact_digest
      !== artifacts.manifest.deployment.artifactDigest
    || bootstrap.rollback_artifact_digest
      !== artifacts.manifest.deployment.rollbackArtifactDigest
    || migration?.version !== MIGRATION_VERSION
    || !safeHashEqual(
      migration?.checksum,
      artifacts.manifest.implementation.migrationSha256,
    )
    || globalGenesisEventCount !== 1
  ) {
    throw new TypeError("bootstrap singleton or migration journal is not manifest-bound");
  }
  if (
    !approval
    || approval.id !== bootstrap.approval_internal_id
    || approval.created_by !== bootstrap.founder_principal_id
    || approval.approval_id !== bootstrap.external_approval_id
    || approval.hcp_identifier !== "HCP-0031"
    || approval.subject_type !== "approval_system"
    || approval.change_class !== "approval_system"
    || approval.state !== "draft"
    || approval.patent_locked
    || approval.renovate_patch_only
    || approval.expires_at !== null
    || !safeHashEqual(approval.payload_sha256, artifacts.manifestSha256)
    || !safeHashEqual(
      approval.diff_sha256,
      artifacts.manifest.implementation.sourceTreeSha256,
    )
    || approval.artifact_digest !== artifacts.manifest.deployment.artifactDigest
    || approval.policy_version !== artifacts.manifest.implementation.policyVersion
    || !safeHashEqual(
      approval.policy_sha256,
      artifacts.manifest.implementation.policySourceSha256,
    )
  ) {
    throw new TypeError("genesis approval is not an exact draft projection of the manifest");
  }
  assertEqualCanonical(approval.canonical_payload, artifacts.manifest, "genesis payload");
  assertEqualCanonical(approval.zone_paths, GENESIS_ZONE_PATHS, "genesis zone paths");

  if (events.length !== 1 || receipts.length !== 1 || outbox.length !== 1) {
    throw new TypeError("genesis approval must have exactly one event, receipt, and outbox row");
  }
  const event = events[0];
  const receipt = receipts[0];
  if (
    event.id !== bootstrap.bootstrap_event_id
    || event.event_type !== "system_bootstrapped"
    || Number(event.sequence) !== 1
    || event.actor_principal_id !== bootstrap.founder_principal_id
    || event.actor_key_id !== null
    || event.evidence_class !== null
    || event.resulting_state !== "draft"
    || event.previous_event_sha256 !== null
    || event.policy_input?.genesis?.manifestSha256 !== artifacts.manifestSha256
    || event.policy_input?.genesis?.manifestSignatureSha256 !== artifacts.signatureSha256
    || event.policy_input?.genesis?.principalSeedSha256 !== artifacts.principalSeedSha256
    || event.policy_input?.genesis?.target !== GENESIS_TARGET.confirmation
    || event.policy_result?.allow !== false
    || !event.policy_result?.reasons?.includes("approval_not_pending")
    || receipt.event_id !== event.id
    || receipt.canonical_payload?.eventSha256 !== event.event_sha256
  ) {
    throw new TypeError("genesis event or receipt binding is invalid");
  }
  if (
    outbox[0].event_id !== event.id
    || outbox[0].topic !== "heady.approval.system_bootstrapped"
    || outbox[0].payload?.genesisManifestSha256 !== artifacts.manifestSha256
    || outbox[0].payload?.receiptId !== receipt.receipt_id
  ) {
    throw new TypeError("genesis outbox projection is not bound to the first event");
  }

  const seed = artifacts.principalSeed;
  const principalByStableId = new Map(
    principals.map((principal) => [principal.stable_identifier, principal]),
  );
  const founder = principalByStableId.get(seed.founder.stableIdentifier);
  const arbiter = principalByStableId.get(seed.arbiter.stableIdentifier);
  const deploymentGuard = principalByStableId.get(seed.deploymentGuard.stableIdentifier);
  if (
    principals.length !== 3
    || !founder
    || founder.id !== bootstrap.founder_principal_id
    || founder.principal_type !== "human"
    || founder.principal_role !== "founder"
    || founder.active !== true
    || founder.firebase_uid !== seed.founder.firebaseUid
    || founder.verified_email !== seed.founder.verifiedEmail
    || founder.workload_identity !== null
    || canonicalize(founder.allowed_evidence_classes)
      !== canonicalize(["founder_decision"])
    || !arbiter
    || arbiter.principal_type !== "service"
    || arbiter.principal_role !== "arbiter"
    || arbiter.active !== true
    || arbiter.workload_identity !== seed.arbiter.workloadIdentity
    || canonicalize(arbiter.allowed_evidence_classes)
      !== canonicalize(["arbiter_attestation"])
    || !deploymentGuard
    || deploymentGuard.principal_type !== "service"
    || deploymentGuard.principal_role !== "deployment_guard"
    || deploymentGuard.active !== true
    || deploymentGuard.workload_identity !== seed.deploymentGuard.workloadIdentity
    || canonicalize(deploymentGuard.allowed_evidence_classes) !== canonicalize([])
  ) {
    throw new TypeError("principal registry differs from the reviewed three-principal seed");
  }
  const founderKeys = founder.keys ?? [];
  const arbiterKeys = arbiter.keys ?? [];
  if (
    founderKeys.length !== 1
    || arbiterKeys.length !== 1
    || (deploymentGuard.keys ?? []).length !== 0
    || founderKeys[0].active !== true
    || arbiterKeys[0].active !== true
    || !safeHashEqual(
      founderKeys[0].fingerprint,
      publicJwkFingerprint(seed.founder.publicJwk),
    )
    || !safeHashEqual(
      arbiterKeys[0].fingerprint,
      publicJwkFingerprint(seed.arbiter.publicJwk),
    )
    || receiptKeys.length !== 1
    || receiptKeys[0].active !== true
    || !safeHashEqual(
      receiptKeys[0].fingerprint,
      artifacts.manifest.publicKeys.receiptSigner,
    )
  ) {
    throw new TypeError("principal or receipt key registry differs from the signed manifest");
  }
  if (
    auditReplays.length !== 1
    || auditReplays[0].valid !== true
    || Number(auditReplays[0].through_sequence) !== 1
    || Number(auditReplays[0].receipt_count) !== 1
    || auditReplays[0].verifier_principal_id !== founder.id
    || !safeHashEqual(auditReplays[0].chain_head_sha256, event.event_sha256)
  ) {
    throw new TypeError("genesis audit replay snapshot is missing or invalid");
  }
}

async function readGenesisRows(client) {
  const bootstrapResult = await client.query(`
    SELECT
      bootstrap_record.*,
      event_record.approval_id AS approval_internal_id,
      approval_record.approval_id AS external_approval_id
    FROM heady_approval.bootstrap bootstrap_record
    JOIN heady_approval.events event_record
      ON event_record.id = bootstrap_record.bootstrap_event_id
    JOIN heady_approval.approvals approval_record
      ON approval_record.id = event_record.approval_id
  `);
  if (bootstrapResult.rowCount !== 1) {
    throw new TypeError("production must contain exactly one bootstrap singleton");
  }
  const bootstrap = bootstrapResult.rows[0];
  const [
    approvalResult,
    eventResult,
    receiptResult,
    principalResult,
    receiptKeyResult,
    outboxResult,
    replayResult,
    migrationResult,
    globalGenesisEventResult,
  ] = await Promise.all([
    client.query("SELECT * FROM heady_approval.approvals WHERE id = $1", [
      bootstrap.approval_internal_id,
    ]),
    client.query(`
      SELECT
        event_record.*,
        principal_key.public_jwk AS actor_public_jwk,
        principal_key.fingerprint AS actor_key_fingerprint
      FROM heady_approval.events event_record
      LEFT JOIN heady_approval.principal_keys principal_key
        ON principal_key.id = event_record.actor_key_id
      WHERE event_record.approval_id = $1
      ORDER BY event_record.sequence
    `, [bootstrap.approval_internal_id]),
    client.query(`
      SELECT
        receipt_record.*,
        signer.public_jwk AS registered_public_jwk,
        signer.fingerprint AS registered_key_fingerprint,
        signer.valid_from AS registered_key_valid_from
      FROM heady_approval.receipts receipt_record
      JOIN heady_approval.events event_record
        ON event_record.id = receipt_record.event_id
      JOIN heady_approval.receipt_signing_keys signer
        ON signer.key_id = receipt_record.signing_key_id
      WHERE event_record.approval_id = $1
      ORDER BY event_record.sequence
    `, [bootstrap.approval_internal_id]),
    client.query(`
      SELECT
        principal_record.*,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'fingerprint', principal_key.fingerprint,
              'publicJwk', principal_key.public_jwk,
              'active', principal_key.active
            )
            ORDER BY principal_key.created_at
          ) FILTER (WHERE principal_key.id IS NOT NULL),
          '[]'::jsonb
        ) AS keys
      FROM heady_approval.principals principal_record
      LEFT JOIN heady_approval.principal_keys principal_key
        ON principal_key.principal_id = principal_record.id
      GROUP BY principal_record.id
      ORDER BY principal_record.stable_identifier
    `),
    client.query(`
      SELECT *
      FROM heady_approval.receipt_signing_keys
      ORDER BY created_at
    `),
    client.query(`
      SELECT *
      FROM heady_approval.outbox
      WHERE event_id = $1
    `, [bootstrap.bootstrap_event_id]),
    client.query(`
      SELECT *
      FROM heady_approval.audit_replays
      WHERE approval_id = $1
      ORDER BY created_at
    `, [bootstrap.approval_internal_id]),
    client.query(`
      SELECT version, checksum
      FROM schema_migrations
      WHERE version = $1
    `, [MIGRATION_VERSION]),
    client.query(`
      SELECT count(*)::int AS count
      FROM heady_approval.events
      WHERE event_type = 'system_bootstrapped'
    `),
  ]);
  return {
    bootstrap,
    approval: approvalResult.rows[0],
    events: eventResult.rows,
    receipts: receiptResult.rows,
    principals: principalResult.rows,
    receiptKeys: receiptKeyResult.rows,
    outbox: outboxResult.rows,
    auditReplays: replayResult.rows,
    migration: migrationResult.rows[0],
    globalGenesisEventCount: globalGenesisEventResult.rows[0]?.count,
  };
}

export async function verifyGenesis({
  ownerConnectionString,
  runtimeConnectionString,
  neonApiKey,
  artifacts,
  fetchFn = globalThis.fetch,
  ClientClass = pg.Client,
  PoolClass = pg.Pool,
}) {
  const [ownerTarget, runtimeTarget] = await Promise.all([
    verifyNeonTarget({
      connectionString: ownerConnectionString,
      apiKey: neonApiKey,
      pooled: false,
      fetchFn,
    }),
    verifyNeonTarget({
      connectionString: runtimeConnectionString,
      apiKey: neonApiKey,
      pooled: true,
      fetchFn,
    }),
  ]);
  if (ownerTarget.endpointId !== runtimeTarget.endpointId) {
    throw new TypeError("owner and runtime URLs must resolve to the same production compute");
  }

  const policyEvaluator = await createPolicyEvaluator();
  if (
    policyEvaluator.version !== artifacts.manifest.implementation.policyVersion
    || !safeHashEqual(
      policyEvaluator.sourceSha256,
      artifacts.manifest.implementation.policySourceSha256,
    )
  ) {
    throw new TypeError("verifier policy differs from the signed genesis manifest");
  }
  const ownerClient = new ClientClass({
    connectionString: ownerConnectionString,
    application_name: "heady-approval-genesis-read-only-verifier",
  });
  await ownerClient.connect();
  let rows;
  let replay;
  try {
    await ownerClient.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const database = await ownerClient.query("SELECT current_database() AS database_name");
    if (database.rows[0]?.database_name !== GENESIS_TARGET.databaseName) {
      throw new TypeError("owner verifier session is not on the pinned production database");
    }
    rows = await readGenesisRows(ownerClient);
    assertBootstrapRows({ artifacts, ...rows });
    replay = await replayApprovalHistory({
      approval: rows.approval,
      events: rows.events,
      receipts: rows.receipts,
      policyEvaluator,
    });
    if (!replay.valid) {
      throw new TypeError(`read-only genesis replay failed: ${replay.errors.join("; ")}`);
    }
    await ownerClient.query("COMMIT");
  } catch (error) {
    await rollbackAndThrow(ownerClient, error);
  } finally {
    await ownerClient.end();
  }

  const runtimeDatabase = createPgDatabase({
    connectionString: runtimeConnectionString,
    PoolClass,
  });
  try {
    await runtimeDatabase.assertRuntimeAuthority();
  } finally {
    await runtimeDatabase.end();
  }

  const report = {
    schema: "heady.approval.genesis.verification-report.v1",
    target: ownerTarget,
    manifestSha256: artifacts.manifestSha256,
    approvalId: rows.approval.approval_id,
    eventId: rows.events[0].id,
    eventSha256: rows.events[0].event_sha256,
    receiptId: rows.receipts[0].receipt_id,
    receiptPayloadSha256: rows.receipts[0].payload_sha256,
    auditReplayValid: replay.valid,
    runtimeLeastPrivilege: true,
    bootstrapCount: 1,
  };
  return Object.freeze({
    ...report,
    reportSha256: sha256(report),
  });
}
