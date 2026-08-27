// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Approval API Authentication v1.0.0                      ║
// ║  Firebase humans and audience-bound Google workload identities. ║
// ║  Made with ❤️ by HeadySystems Inc.                              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { UnauthorizedError } from "@heady/shared";

function bearerToken(request) {
  const header = request.header("authorization");
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(header ?? "");
  if (!match) throw new UnauthorizedError("a bearer token is required");
  return match[1];
}

export function createAuthenticator({
  firebaseAuth,
  workloadClient,
  workloadAudience,
}) {
  async function human(request) {
    const decoded = await firebaseAuth.verifyIdToken(bearerToken(request), true);
    if (!decoded.uid || !decoded.email || decoded.email_verified !== true) {
      throw new UnauthorizedError("verified Firebase identity required");
    }
    return {
      authType: "firebase",
      subject: decoded.uid,
      email: decoded.email,
      emailVerified: true,
    };
  }

  async function workload(request) {
    const ticket = await workloadClient.verifyIdToken({
      idToken: bearerToken(request),
      audience: workloadAudience,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new UnauthorizedError("workload identity has no stable subject");
    return {
      authType: "workload_identity",
      subject: payload.sub,
      email: payload.email ?? null,
      emailVerified: payload.email_verified === true,
    };
  }

  return Object.freeze({ human, workload });
}
