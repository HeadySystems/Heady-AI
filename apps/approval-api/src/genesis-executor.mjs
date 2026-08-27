// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Single-Use Genesis Executor v1.0.0                     ║
// ║  Target-pinned, transactional principal seed and first event.  ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { randomUUID } from "node:crypto";
import pg from "pg";
import { FIB, HEARTBEAT_MS, phiBackoffMs } from "@heady/phi-math";
import {
  ACCEPTED_ADR_0031,
  actorSnapshot,
  buildEventPayload,
  buildPolicyInput,
  buildReceiptPayload,
  canonicalize,
  createPolicyEvaluator,
  createUlid,
  publicJwkFingerprint,
  replayApprovalHistory,
  safeHashEqual,
  sha256,
  verifyReceipt,
} from "@heady/approvals";
import { createKmsReceiptSigner } from "./kms-signer.mjs";
import {
  GENESIS_TARGET,
  GENESIS_ZONE_PATHS,
  verifyFounderFirebaseIdentity,
} from "./genesis-contract.mjs";
import { verifyNeonTarget } from "./genesis-target.mjs";

const MIGRATION_VERSION = "0004_approval_control_plane.sql";
const RECEIPT_ALGORITHM = "EC_SIGN_ED25519";
const GENESIS_ADVISORY_LOCK = "heady.approval.genesis.v1";

async function rollbackAndThrow(client, originalError) {
  try {
    await client.query("ROLLBACK");
  } catch (rollbackError) {
    throw new AggregateError(
      [originalError, rollbackError],
      "genesis failed and its rollback command also failed",
    );
  }
  throw originalError;
}

function requirePolicyResult(policyResult) {
  if (
    policyResult.allow !== false
    || !policyResult.reasons.includes("approval_not_pending")
    || canonicalize(policyResult.requiredEvidence)
      !== canonicalize(["founder_decision", "external_security_review"])
  ) {
    throw new TypeError("pinned policy does not return the expected fail-closed genesis decision");
  }
}

function genesisTraceId(manifestSha256) {
  return `heady-genesis-${manifestSha256}`;
}

export async function buildGenesisMaterial({
  artifacts,
  founderPrincipal,
  signer,
  policyEvaluator,
  occurredAt,
  ids = {},
}) {
  const approvalId = ids.approvalId ?? createUlid({
    now: () => new Date(occurredAt).getTime(),
  });
  const approvalInternalId = ids.approvalInternalId ?? randomUUID();
  const eventId = ids.eventId ?? randomUUID();
  const receiptInternalId = ids.receiptInternalId ?? randomUUID();
  const receiptId = ids.receiptId ?? createUlid({
    now: () => new Date(occurredAt).getTime(),
  });
  const traceId = genesisTraceId(artifacts.manifestSha256);
  const approval = {
    id: approvalInternalId,
    approval_id: approvalId,
    hcp_identifier: "HCP-0031",
    title: "ADR-0031 approval service genesis",
    subject_type: "approval_system",
    change_class: "approval_system",
    patent_locked: false,
    renovate_patch_only: false,
    zone_paths: [...GENESIS_ZONE_PATHS],
    canonical_payload: artifacts.manifest,
    payload_sha256: artifacts.manifestSha256,
    diff_sha256: artifacts.manifest.implementation.sourceTreeSha256,
    artifact_digest: artifacts.manifest.deployment.artifactDigest,
    state: "draft",
    policy_version: artifacts.manifest.implementation.policyVersion,
    policy_sha256: artifacts.manifest.implementation.policySourceSha256,
    expires_at: null,
    // buildPolicyInput() projects this to policyInput.creatorPrincipalId, which
    // audit replay (audit.mjs) requires to equal approval.created_by. Added when
    // policy-input.mjs began reading the field (a7292fc5ae, after this executor
    // was written) — without it canonicalize() throws on undefined. The two rego
    // rules that read creatorPrincipalId are scoped to the autonomous lane, so
    // naming the founder here has no policy effect on the genesis path.
    created_by: founderPrincipal.id,
  };
  const policyInput = {
    ...buildPolicyInput({
      approval,
      evidenceRows: [],
      nowEpochMs: new Date(occurredAt).getTime(),
    }),
    genesis: {
      schema: "heady.approval.genesis.event-binding.v1",
      manifestSha256: artifacts.manifestSha256,
      manifestSignatureSha256: artifacts.signatureSha256,
      principalSeedSha256: artifacts.principalSeedSha256,
      acceptedTagObject: ACCEPTED_ADR_0031.tagObject,
      target: GENESIS_TARGET.confirmation,
    },
  };
  const policyResult = await policyEvaluator.evaluate(policyInput);
  requirePolicyResult(policyResult);
  approval.required_evidence = policyResult.missingEvidence;

  const operationSha256 = sha256({
    action: "system_bootstrapped",
    target: GENESIS_TARGET,
    manifestSha256: artifacts.manifestSha256,
    manifestSignatureSha256: artifacts.signatureSha256,
    principalSeedSha256: artifacts.principalSeedSha256,
  });
  const snapshot = actorSnapshot(founderPrincipal, {
    authType: "firebase",
  });
  const eventPayload = buildEventPayload({
    eventId,
    approvalId,
    sequence: 1,
    eventType: "system_bootstrapped",
    actorPrincipalId: founderPrincipal.id,
    actorKeyId: null,
    reason: `Single-use ADR-0031 genesis ${artifacts.manifestSha256}`,
    actorSnapshot: snapshot,
    policyInput,
    policyResult,
    resultingState: "draft",
    previousEventSha256: null,
    traceId,
    idempotencyKey: `genesis:${artifacts.manifestSha256}`,
    operationSha256,
    occurredAt,
  });
  const eventSha256 = sha256(eventPayload);
  const receiptPayload = buildReceiptPayload({
    receiptId,
    approvalId,
    eventId,
    sequence: 1,
    eventSha256,
    previousEventSha256: null,
    payloadSha256: approval.payload_sha256,
    diffSha256: approval.diff_sha256,
    policySha256: approval.policy_sha256,
    state: "draft",
    issuedAt: occurredAt,
  });
  const receiptPayloadSha256 = sha256(receiptPayload);
  const signedReceipt = await signer.sign({
    payload: Buffer.from(canonicalize(receiptPayload)),
    payloadSha256: receiptPayloadSha256,
  });
  if (
    signedReceipt.algorithm !== RECEIPT_ALGORITHM
    || signedReceipt.publicJwkVersion !== signedReceipt.signingKeyId
    || !verifyReceipt({
      payload: receiptPayload,
      payloadSha256: receiptPayloadSha256,
      signature: signedReceipt.signature,
      publicJwk: signedReceipt.publicJwk,
    })
  ) {
    throw new TypeError("genesis receipt signer returned invalid or inconsistent material");
  }

  return Object.freeze({
    approval,
    event: {
      ...eventPayload,
      eventSha256,
    },
    receipt: {
      id: receiptInternalId,
      payload: receiptPayload,
      payloadSha256: receiptPayloadSha256,
      ...signedReceipt,
    },
    outbox: {
      schema: "heady.approval.outbox.v1",
      approvalId,
      eventId,
      sequence: 1,
      state: "draft",
      eventSha256,
      receiptId,
      traceId,
      genesisManifestSha256: artifacts.manifestSha256,
    },
    traceId,
    occurredAt,
  });
}

async function assertOwnerPreconditions(client, artifacts) {
  const authority = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS role_name,
      pg_has_role(current_user, 'heady_approval_api', 'member') AS api_member,
      EXISTS (
        SELECT 1
        FROM pg_database database_record
        WHERE database_record.datname = current_database()
          AND pg_has_role(current_user, database_record.datdba, 'member')
      ) AS database_owner_member,
      has_table_privilege(current_user, 'heady_approval.bootstrap', 'INSERT')
        AS can_insert_bootstrap,
      (SELECT count(*)::int FROM heady_approval.principals) AS principal_count,
      (SELECT count(*)::int FROM heady_approval.principal_keys) AS principal_key_count,
      (SELECT count(*)::int FROM heady_approval.receipt_signing_keys)
        AS receipt_key_count,
      (SELECT count(*)::int FROM heady_approval.approvals) AS approval_count,
      (SELECT count(*)::int FROM heady_approval.events) AS event_count,
      (SELECT count(*)::int FROM heady_approval.receipts) AS receipt_count,
      (SELECT count(*)::int FROM heady_approval.outbox) AS outbox_count,
      (SELECT count(*)::int FROM heady_approval.audit_replays) AS replay_count,
      (SELECT count(*)::int FROM heady_approval.bootstrap) AS bootstrap_count
  `);
  const row = authority.rows[0];
  const counts = [
    row?.principal_count,
    row?.principal_key_count,
    row?.receipt_key_count,
    row?.approval_count,
    row?.event_count,
    row?.receipt_count,
    row?.outbox_count,
    row?.replay_count,
    row?.bootstrap_count,
  ];
  if (
    !row
    || row.database_name !== GENESIS_TARGET.databaseName
    || row.api_member
    || !row.database_owner_member
    || !row.can_insert_bootstrap
    || counts.some((count) => count !== 0)
  ) {
    throw new TypeError("genesis owner authority or empty-schema precondition failed");
  }

  const migration = await client.query(`
    SELECT checksum
    FROM schema_migrations
    WHERE version = $1
  `, [MIGRATION_VERSION]);
  if (
    migration.rowCount !== 1
    || !safeHashEqual(
      migration.rows[0].checksum,
      artifacts.manifest.implementation.migrationSha256,
    )
  ) {
    throw new TypeError("production approval migration is missing or checksum-drifted");
  }
}

async function seedPrincipals(client, artifacts, occurredAt) {
  const founderId = randomUUID();
  const arbiterId = randomUUID();
  const deploymentGuardId = randomUUID();
  const founderKeyId = randomUUID();
  const arbiterKeyId = randomUUID();
  const seed = artifacts.principalSeed;

  await client.query(`
    INSERT INTO heady_approval.principals (
      id, stable_identifier, principal_type, principal_role,
      firebase_uid, verified_email, workload_identity,
      allowed_evidence_classes, created_at
    ) VALUES
      ($1, $2, 'human', 'founder', $3, $4, NULL,
       ARRAY['founder_decision']::TEXT[], $11),
      ($5, $6, 'service', 'arbiter', NULL, NULL, $7,
       ARRAY['arbiter_attestation']::TEXT[], $11),
      ($8, $9, 'service', 'deployment_guard', NULL, NULL, $10,
       ARRAY[]::TEXT[], $11)
  `, [
    founderId,
    seed.founder.stableIdentifier,
    seed.founder.firebaseUid,
    seed.founder.verifiedEmail,
    arbiterId,
    seed.arbiter.stableIdentifier,
    seed.arbiter.workloadIdentity,
    deploymentGuardId,
    seed.deploymentGuard.stableIdentifier,
    seed.deploymentGuard.workloadIdentity,
    occurredAt,
  ]);
  await client.query(`
    INSERT INTO heady_approval.principal_keys (
      id, principal_id, fingerprint, public_jwk, valid_from, created_at
    ) VALUES
      ($1, $2, $3, $4, $9, $9),
      ($5, $6, $7, $8, $9, $9)
  `, [
    founderKeyId,
    founderId,
    publicJwkFingerprint(seed.founder.publicJwk),
    seed.founder.publicJwk,
    arbiterKeyId,
    arbiterId,
    publicJwkFingerprint(seed.arbiter.publicJwk),
    seed.arbiter.publicJwk,
    occurredAt,
  ]);
  return Object.freeze({
    founder: {
      id: founderId,
      stable_identifier: seed.founder.stableIdentifier,
      principal_type: "human",
      principal_role: "founder",
    },
  });
}

async function insertGenesisRows(client, {
  artifacts,
  principals,
  material,
}) {
  const { approval, event, receipt } = material;
  await client.query(`
    INSERT INTO heady_approval.receipt_signing_keys (
      key_id, fingerprint, public_jwk, valid_from, created_at
    ) VALUES ($1, $2, $3, $4, $4)
  `, [
    receipt.signingKeyId,
    publicJwkFingerprint(receipt.publicJwk),
    receipt.publicJwk,
    material.occurredAt,
  ]);
  await client.query(`
    INSERT INTO heady_approval.approvals (
      id, approval_id, hcp_identifier, title, subject_type, change_class,
      patent_locked, renovate_patch_only, zone_paths, canonical_payload,
      payload_sha256, diff_sha256, artifact_digest, state, policy_version,
      policy_sha256, required_evidence, expires_at, created_by, trace_id,
      creation_idempotency_key, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      'draft', $14, $15, $16, NULL, $17, $18, $19, $20, $20
    )
  `, [
    approval.id,
    approval.approval_id,
    approval.hcp_identifier,
    approval.title,
    approval.subject_type,
    approval.change_class,
    approval.patent_locked,
    approval.renovate_patch_only,
    approval.zone_paths,
    approval.canonical_payload,
    approval.payload_sha256,
    approval.diff_sha256,
    approval.artifact_digest,
    approval.policy_version,
    approval.policy_sha256,
    approval.required_evidence,
    principals.founder.id,
    material.traceId,
    event.idempotencyKey,
    material.occurredAt,
  ]);
  await client.query(`
    INSERT INTO heady_approval.events (
      id, approval_id, sequence, event_type, actor_principal_id,
      actor_key_id, evidence_class, decision, verdict, reason, nonce,
      evidence_expires_at, evidence_envelope, evidence_sha256,
      evidence_signature, actor_snapshot, policy_input, policy_result,
      resulting_state, previous_event_sha256, event_sha256, trace_id,
      idempotency_key, operation_sha256, occurred_at
    ) VALUES (
      $1, $2, 1, 'system_bootstrapped', $3, NULL, NULL, NULL, NULL,
      $4, NULL, NULL, NULL, NULL, NULL, $5, $6, $7, 'draft', NULL,
      $8, $9, $10, $11, $12
    )
  `, [
    event.eventId,
    approval.id,
    principals.founder.id,
    event.reason,
    event.actorSnapshot,
    event.policyInput,
    event.policyResult,
    event.eventSha256,
    material.traceId,
    event.idempotencyKey,
    event.operationSha256,
    material.occurredAt,
  ]);
  await client.query(`
    INSERT INTO heady_approval.receipts (
      id, receipt_id, event_id, canonical_payload, payload_sha256,
      signing_key_id, algorithm, signature, public_jwk, public_jwk_version,
      signature_verified, issued_at, last_audit_verified_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $11
    )
  `, [
    receipt.id,
    receipt.payload.receiptId,
    event.eventId,
    receipt.payload,
    receipt.payloadSha256,
    receipt.signingKeyId,
    receipt.algorithm,
    receipt.signature,
    receipt.publicJwk,
    receipt.publicJwkVersion,
    material.occurredAt,
  ]);
  await client.query(`
    INSERT INTO heady_approval.outbox (
      event_id, topic, payload, created_at, available_at
    ) VALUES ($1, 'heady.approval.system_bootstrapped', $2, $3, $3)
  `, [event.eventId, material.outbox, material.occurredAt]);
  await client.query(`
    INSERT INTO heady_approval.bootstrap (
      singleton, accepted_commit_sha, accepted_tag, accepted_tag_object_sha,
      accepted_signer_fingerprint, genesis_manifest_sha256, migration_sha256,
      deployment_artifact_digest, rollback_artifact_digest,
      founder_principal_id, bootstrap_event_id, created_at
    ) VALUES (
      TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    )
  `, [
    ACCEPTED_ADR_0031.acceptedCommit,
    ACCEPTED_ADR_0031.tag,
    ACCEPTED_ADR_0031.tagObject,
    ACCEPTED_ADR_0031.signerFingerprint,
    artifacts.manifestSha256,
    artifacts.manifest.implementation.migrationSha256,
    artifacts.manifest.deployment.artifactDigest,
    artifacts.manifest.deployment.rollbackArtifactDigest,
    principals.founder.id,
    event.eventId,
    material.occurredAt,
  ]);
}

async function replayAndRecord(client, {
  material,
  principals,
  policyEvaluator,
}) {
  const approvalResult = await client.query(`
    SELECT *
    FROM heady_approval.approvals
    WHERE id = $1
  `, [material.approval.id]);
  const eventResult = await client.query(`
    SELECT
      event_record.*,
      principal_key.public_jwk AS actor_public_jwk,
      principal_key.fingerprint AS actor_key_fingerprint
    FROM heady_approval.events event_record
    LEFT JOIN heady_approval.principal_keys principal_key
      ON principal_key.id = event_record.actor_key_id
    WHERE event_record.approval_id = $1
    ORDER BY event_record.sequence
  `, [material.approval.id]);
  const receiptResult = await client.query(`
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
  `, [material.approval.id]);
  const replay = await replayApprovalHistory({
    approval: approvalResult.rows[0],
    events: eventResult.rows,
    receipts: receiptResult.rows,
    policyEvaluator,
  });
  if (!replay.valid) {
    throw new TypeError(`genesis audit replay failed: ${replay.errors.join("; ")}`);
  }
  await client.query(`
    INSERT INTO heady_approval.audit_replays (
      approval_id, through_sequence, valid, chain_head_sha256, policy_sha256,
      receipt_count, verification_summary, verifier_principal_id, trace_id,
      created_at
    ) VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7, $8, $9)
  `, [
    material.approval.id,
    replay.throughSequence,
    replay.chainHeadSha256,
    replay.policySha256,
    replay.receiptCount,
    replay,
    principals.founder.id,
    material.traceId,
    material.occurredAt,
  ]);
  return replay;
}

export async function executeGenesis({
  connectionString,
  neonApiKey,
  receiptKeyVersionName,
  artifacts,
  firebaseAuth,
  founderIdToken,
  fetchFn = globalThis.fetch,
  ClientClass = pg.Client,
  kmsClient,
  clock = () => new Date(),
}) {
  await verifyFounderFirebaseIdentity({
    firebaseAuth,
    idToken: founderIdToken,
    principalSeed: artifacts.principalSeed,
  });
  const target = await verifyNeonTarget({
    connectionString,
    apiKey: neonApiKey,
    pooled: false,
    fetchFn,
  });
  if (receiptKeyVersionName === artifacts.signature.keyVersionName) {
    throw new TypeError("receipt signer must not reuse the founder evidence key version");
  }
  const signer = await createKmsReceiptSigner({
    keyVersionName: receiptKeyVersionName,
    client: kmsClient,
  });
  if (
    !safeHashEqual(
      publicJwkFingerprint(signer.publicJwk),
      artifacts.manifest.publicKeys.receiptSigner,
    )
    || canonicalize(signer.publicJwk)
      === canonicalize(artifacts.principalSeed.arbiter.publicJwk)
  ) {
    throw new TypeError("receipt KMS key is not the distinct key pinned by the manifest");
  }

  const policyEvaluator = await createPolicyEvaluator();
  if (
    policyEvaluator.version !== artifacts.manifest.implementation.policyVersion
    || !safeHashEqual(
      policyEvaluator.sourceSha256,
      artifacts.manifest.implementation.policySourceSha256,
    )
    || !safeHashEqual(
      policyEvaluator.wasmSha256,
      artifacts.manifest.implementation.policyWasmSha256,
    )
  ) {
    throw new TypeError("loaded approval policy differs from the signed genesis manifest");
  }

  const client = new ClientClass({
    connectionString,
    application_name: "heady-approval-genesis-single-use",
    connectionTimeoutMillis: phiBackoffMs(FIB[3]),
  });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query(
      "SELECT set_config('statement_timeout', $1, true), "
      + "set_config('lock_timeout', $2, true), "
      + "set_config('idle_in_transaction_session_timeout', $3, true)",
      [
        `${HEARTBEAT_MS}ms`,
        `${phiBackoffMs(FIB[2])}ms`,
        `${HEARTBEAT_MS}ms`,
      ],
    );
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [GENESIS_ADVISORY_LOCK],
    );
    await assertOwnerPreconditions(client, artifacts);
    const occurredAt = new Date(clock()).toISOString();
    const principals = await seedPrincipals(client, artifacts, occurredAt);
    const material = await buildGenesisMaterial({
      artifacts,
      founderPrincipal: principals.founder,
      signer,
      policyEvaluator,
      occurredAt,
    });
    await insertGenesisRows(client, { artifacts, principals, material });
    const replay = await replayAndRecord(client, {
      material,
      principals,
      policyEvaluator,
    });
    await client.query("COMMIT");
    return Object.freeze({
      schema: "heady.approval.genesis.execution-result.v1",
      target,
      manifestSha256: artifacts.manifestSha256,
      approvalId: material.approval.approval_id,
      eventId: material.event.eventId,
      eventSha256: material.event.eventSha256,
      receiptId: material.receipt.payload.receiptId,
      receiptPayloadSha256: material.receipt.payloadSha256,
      replay,
      occurredAt,
    });
  } catch (error) {
    await rollbackAndThrow(client, error);
  } finally {
    await client.end();
  }
}
