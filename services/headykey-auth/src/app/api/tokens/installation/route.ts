import { NextResponse } from 'next/server';
import { App } from '@octokit/app';

export const runtime = 'edge'; // Max speed execution for HeadyBee swarms

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const org = searchParams.get('org');

  if (!org) {
    return NextResponse.json({ error: 'org query parameter is required' }, { status: 400 });
  }

  try {
    // Generate stateless App instance natively compatible with Edge crypto
    const app = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n')!,
    });

    let targetInstallationId = null;
    
    // Iterate installations to find mapping for requested org
    for await (const { installation } of app.eachInstallation.iterator()) {
      if (installation.account?.login.toLowerCase() === org.toLowerCase()) {
        targetInstallationId = installation.id;
        break;
      }
    }

    if (!targetInstallationId) {
      return NextResponse.json({ error: `Installation not found for org: ${org}` }, { status: 404 });
    }

    // Provision fresh, auto-rotating installation token
    const octokit = await app.getInstallationOctokit(targetInstallationId);
    const authData = await octokit.auth({ type: 'installation' }) as any;

    return NextResponse.json({ 
      token: authData.token, 
      installationId: targetInstallationId,
      org,
      expires_in: 3600 // Standard 1-hr TTL
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
