import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { Octokit } from 'octokit';

// Enforce nodejs runtime because firebase-admin SDK requires native Node capabilities
export const runtime = 'nodejs';

// Pre-initialize Firebase Admin if not already loaded
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  try {
    // 1. Exchange OAuth code for User Access Token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_APP_CLIENT_ID,
        client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
        code,
      }),
    });
    
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return NextResponse.json({ error: tokenData.error }, { status: 400 });
    }

    const { access_token } = tokenData;

    // 2. Fetch authenticated user data
    const userOctokit = new Octokit({ auth: access_token });
    const { data: ghUser } = await userOctokit.request('GET /user');

    // 3. Mint Firebase Custom Token explicitly tying GitHub Identity
    const firebaseUid = `github:${ghUser.id}`;
    
    const customToken = await admin.auth().createCustomToken(firebaseUid, {
      provider: 'github',
      githubLogin: ghUser.login,
      githubId: ghUser.id,
      tier: 'founder' // Can be dynamic based on database lookups
    });

    // 4. Redirect cleanly back to the origin with the token embedded
    // Usually state parameter would map to the originating redirect_uri securely
    return NextResponse.redirect(`https://headyme.com/dashboard?token=${customToken}`);

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
