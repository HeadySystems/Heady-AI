// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Auth Tests v1.0.0                          ║
// ║  Firebase and Google workload claim projection tests.           ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder               ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthenticator } from "../src/auth.mjs";

function incoming(value) {
  return {
    header(name) {
      return name === "authorization" ? value : undefined;
    },
  };
}

test("Firebase and workload credentials project only verified server claims", async () => {
  const authenticator = createAuthenticator({
    firebaseAuth: {
      async verifyIdToken(token, checkRevoked) {
        assert.equal(token, "firebase.jwt");
        assert.equal(checkRevoked, true);
        return {
          uid: "firebase-uid",
          email: "eric@headysystems.com",
          email_verified: true,
        };
      },
    },
    workloadClient: {
      async verifyIdToken({ idToken, audience }) {
        assert.equal(idToken, "workload.jwt");
        assert.equal(audience, "approval-service-audience");
        return {
          getPayload() {
            return { sub: "workload-subject", email: "service@example.invalid" };
          },
        };
      },
    },
    workloadAudience: "approval-service-audience",
  });

  assert.deepEqual(await authenticator.human(incoming("Bearer firebase.jwt")), {
    authType: "firebase",
    subject: "firebase-uid",
    email: "eric@headysystems.com",
    emailVerified: true,
  });
  assert.deepEqual(await authenticator.workload(incoming("Bearer workload.jwt")), {
    authType: "workload_identity",
    subject: "workload-subject",
    email: "service@example.invalid",
    emailVerified: false,
  });
});

test("missing bearer credentials fail before provider verification", async () => {
  const authenticator = createAuthenticator({
    firebaseAuth: { verifyIdToken() { throw new Error("must not be called"); } },
    workloadClient: { verifyIdToken() { throw new Error("must not be called"); } },
    workloadAudience: "approval-service-audience",
  });
  await assert.rejects(() => authenticator.human(incoming(undefined)), /bearer token/);
  await assert.rejects(() => authenticator.workload(incoming("Basic value")), /bearer token/);
});
