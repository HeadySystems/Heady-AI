// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ MCP HTTP Header Helper Tests v1.0.0                    ║
// ║  Verifies sandbox-safe, non-interactive credential resolution   ║
// ║  Made with ❤️ by HeadySystems Inc.                             ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_ROOT_PREFIX = join(tmpdir(), "heady-mcp-header-test-");
const HELPER_PATH = join(dirname(fileURLToPath(import.meta.url)), "heady-mcp-http-headers.sh");
const EXECUTABLE_MODE = 0o700;

async function createFixture(gcloudBody, { withCredentials = true } = {}) {
  const root = await mkdtemp(TEST_ROOT_PREFIX);
  const binDirectory = join(root, "bin");
  const sourceConfig = join(root, "source-gcloud");
  const credentialFile = join(sourceConfig, "application_default_credentials.json");

  await mkdir(binDirectory, { recursive: true });
  await mkdir(sourceConfig, { recursive: true });
  if (withCredentials) {
    await writeFile(credentialFile, "{}\n", { mode: 0o600 });
  }

  const gcloudPath = join(binDirectory, "gcloud");
  await writeFile(gcloudPath, `#!/usr/bin/env bash\nset -euo pipefail\n${gcloudBody}\n`);
  await chmod(gcloudPath, EXECUTABLE_MODE);

  return { binDirectory, credentialFile, root, sourceConfig };
}

function runHelper(fixture) {
  return spawnSync(HELPER_PATH, {
    encoding: "utf8",
    env: {
      ...process.env,
      CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: "",
      CLOUDSDK_CONFIG: fixture.sourceConfig,
      GOOGLE_APPLICATION_CREDENTIALS: "",
      HEADY_GCP_PROJECT: "",
      HEADY_MCP_SECRET_NAME: "",
      HEADY_MCP_SECRET_VERSION: "",
      HEADY_TEST_CREDENTIAL_FILE: fixture.credentialFile,
      HEADY_TEST_SOURCE_CONFIG: fixture.sourceConfig,
      PATH: `${fixture.binDirectory}:${process.env.PATH}`,
    },
  });
}

test("resolves the latest bearer with ADC and a disposable writable config", async () => {
  const fixture = await createFixture(`
[[ "\${CLOUDSDK_CONFIG}" != "\${HEADY_TEST_SOURCE_CONFIG}" ]]
[[ -d "\${CLOUDSDK_CONFIG}" && -w "\${CLOUDSDK_CONFIG}" ]]
[[ "\${CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE}" == "\${HEADY_TEST_CREDENTIAL_FILE}" ]]
[[ "\${CLOUDSDK_CORE_DISABLE_FILE_LOGGING}" == "true" ]]
[[ "$*" == "secrets versions access latest --secret=heady-mcp-bearer --project=heady-ai --quiet" ]]
printf '%s' 'fixture-bearer'
`);

  try {
    const result = runHelper(fixture);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { Authorization: "Bearer fixture-bearer" });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("fails before invoking gcloud when ADC is unavailable", async () => {
  const fixture = await createFixture("exit 99", { withCredentials: false });

  try {
    const result = runHelper(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires readable Application Default Credentials/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("preserves the gcloud failure and adds an actionable recovery message", async () => {
  const fixture = await createFixture(`
printf '%s\\n' 'Reauthentication is needed' >&2
exit 1
`);

  try {
    const result = runHelper(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Reauthentication is needed/);
    assert.match(result.stderr, /refresh ADC or repair workload identity access/);
    assert.equal(result.stdout, "");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});
