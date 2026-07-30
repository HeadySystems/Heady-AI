// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Founder Firebase Authentication Tests v1.0.0           ║
// ║  Fresh sign-in, project binding, revocation, and UID checks.    ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOUNDER_FIREBASE_PROJECT_ID,
  signInFounderWithPassword,
  verifyFounderIdToken,
} from "../src/founder-firebase-auth.mjs";

const NOW = Date.parse("2026-07-30T12:00:00.000Z");
const TOKEN = "t".repeat(89);

function decoded(overrides = {}) {
  const nowSeconds = Math.floor(NOW / 1_000);
  return {
    uid: "firebase-founder-uid",
    email: "eric@headysystems.com",
    email_verified: true,
    aud: FOUNDER_FIREBASE_PROJECT_ID,
    iss: `https://securetoken.google.com/${FOUNDER_FIREBASE_PROJECT_ID}`,
    auth_time: nowSeconds,
    iat: nowSeconds,
    ...overrides,
  };
}

test("founder password sign-in is verified with revocation and exact UID binding", async () => {
  const calls = [];
  const result = await signInFounderWithPassword({
    firebaseAuth: {
      async verifyIdToken(idToken, checkRevoked) {
        calls.push({ idToken, checkRevoked });
        return decoded();
      },
    },
    apiKey: "firebase-web-api-key-value",
    email: "eric@headysystems.com",
    password: "correct-horse-battery-staple",
    expectedUid: "firebase-founder-uid",
    fetchFn: async (url, options) => {
      assert.match(url, /^https:\/\/identitytoolkit[.]googleapis[.]com\/v1\//);
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {
        email: "eric@headysystems.com",
        password: "correct-horse-battery-staple",
        returnSecureToken: true,
      });
      return {
        ok: true,
        async json() {
          return {
            localId: "firebase-founder-uid",
            email: "eric@headysystems.com",
            idToken: TOKEN,
            expiresIn: "3600",
            registered: true,
            refreshToken: "not-returned-by-the-helper",
          };
        },
      };
    },
    now: () => NOW,
  });
  assert.equal(result.uid, "firebase-founder-uid");
  assert.equal(result.idToken, TOKEN);
  assert.deepEqual(calls, [{ idToken: TOKEN, checkRevoked: true }]);
  assert.equal(Object.hasOwn(result, "refreshToken"), false);
});

test("founder verification rejects stale, wrong-project, and wrong-UID tokens", async () => {
  const cases = [
    decoded({ auth_time: Math.floor((NOW - 60 * 60 * 1_000) / 1_000) }),
    decoded({ aud: "different-project" }),
    decoded({ uid: "different-founder" }),
  ];
  for (const claims of cases) {
    await assert.rejects(() => verifyFounderIdToken({
      firebaseAuth: {
        async verifyIdToken(_idToken, checkRevoked) {
          assert.equal(checkRevoked, true);
          return claims;
        },
      },
      idToken: TOKEN,
      expectedEmail: "eric@headysystems.com",
      expectedUid: "firebase-founder-uid",
      now: () => NOW,
    }), /fresh, verified founder ceremony/);
  }
});

test("founder sign-in errors expose only the sanitized Firebase error code", async () => {
  await assert.rejects(() => signInFounderWithPassword({
    firebaseAuth: {
      async verifyIdToken() {
        throw new Error("must not verify a failed sign-in");
      },
    },
    apiKey: "firebase-web-api-key-value",
    email: "eric@headysystems.com",
    password: "incorrect-password",
    fetchFn: async () => ({
      ok: false,
      async json() {
        return {
          error: {
            message: "INVALID_LOGIN_CREDENTIALS",
            debug: "sensitive upstream context",
          },
        };
      },
    }),
  }), (error) => (
    error.message === "Firebase founder sign-in failed: INVALID_LOGIN_CREDENTIALS"
  ));
});
