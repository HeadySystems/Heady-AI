# 🚀 Heady Next.js Frontend Build Guide
# Optimized for Mini-Computer Edge Deployment & Render Services

## Part 1: Project Initialization with Sacred Geometry

```bash
# Initialize Next.js with Heady conventions
npx create-next-app@latest headyconnection-web \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

cd headyconnection-web
npm install next-drupal sharp
npm install -D @types/node
```

## Part 2: Sacred Geometry Design System

Create `src/styles/heady-theme.ts`:

```typescript
// Sacred Geometry Design Tokens
export const headyTheme = {
  colors: {
    'heady-bg': '#0a0e17',
    'heady-surface': '#111827',
    'heady-cyan': '#22d3ee',
    'heady-emerald': '#34d399',
    'heady-amber': '#fbbf24',
    'heady-magenta': '#c084fc',
  },
  borderRadius: {
    'organic': '1.5rem',
    'pill': '9999px',
  },
  animations: {
    breathing: 'breathing 4s ease-in-out infinite',
  },
};

// Add to tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      colors: headyTheme.colors,
      borderRadius: headyTheme.borderRadius,
      keyframes: {
        breathing: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.02)', opacity: '0.95' },
        },
      },
    },
  },
};
```

## Part 3: Environment Configuration (ZERO LOCALHOST)

Create `.env.local` (never commit):

```bash
# Drupal Backend Connection - PRODUCTION DOMAINS ONLY
NEXT_PUBLIC_DRUPAL_BASE_URL=https://headyme.com
NEXT_PUBLIC_API_BASE_URL=https://headyme.com

# OAuth & Preview (fetch from vault)
DRUPAL_CLIENT_ID=${HEADY_DRUPAL_OAUTH_CLIENT_ID}
DRUPAL_CLIENT_SECRET=${HEADY_DRUPAL_OAUTH_CLIENT_SECRET}
DRUPAL_PREVIEW_SECRET=${HEADY_DRUPAL_PREVIEW_SECRET}

# Cloudflare Integration
CLOUDFLARE_API_TOKEN=${HEADY_CF_API_TOKEN}
CLOUDFLARE_ZONE_ID=${HEADY_CF_ZONE_ID}

# Render.com API (for service management)
RENDER_API_KEY=${HEADY_RENDER_API_KEY}

# Heady Manager API
HEADY_API_URL=https://headyme.com
HEADY_API_KEY=${HEADY_API_KEY}

# Performance Optimization
NEXT_PUBLIC_ENABLE_ISR=true
NEXT_PUBLIC_REVALIDATE_TIME=60
NEXT_PUBLIC_IMAGE_OPTIMIZATION=true
```

## Part 4: Core Next.js Configuration

Create `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization for Drupal
  images: {
    domains: [
      'headyme.com',
      'cms.headyme.com',
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },
  
  // Performance optimizations for mini-computers
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Output optimization for edge deployment
  output: 'standalone',
  
  // Compression
  compress: true,
  
  // Headers for Cloudflare caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
          {
            key: 'X-Powered-By',
            value: 'HeadyConnection - Sacred Geometry',
          },
        ],
      },
    ];
  },
  
  // Redirects for domain standardization
  async redirects() {
    return [
      {
        source: '/admin',
        destination: 'https://headyme.com/admin-ui.html',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
```

## Part 5: Drupal Client Implementation

Create `src/lib/drupal.ts`:

```typescript
import { DrupalClient } from 'next-drupal';

const baseUrl = process.env.NEXT_PUBLIC_DRUPAL_BASE_URL!;
const auth = {
  clientId: process.env.DRUPAL_CLIENT_ID!,
  clientSecret: process.env.DRUPAL_CLIENT_SECRET!,
};

export const drupal = new DrupalClient(baseUrl, {
  auth,
  previewSecret: process.env.DRUPAL_PREVIEW_SECRET,
  cache: process.env.NODE_ENV === 'production',
  debug: process.env.NODE_ENV === 'development',
  
  // Cloudflare cache headers
  headers: {
    'Cache-Control': 'public, max-age=3600',
  },
  
  // Timeout for slow networks
  fetcher: async (url, options) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  },
});

// Health check helper
export async function checkDrupalHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/jsonapi`, {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

## Part 6: Optimized Page Components with ISR

Create `src/app/articles/[...slug]/page.tsx`:

```typescript
import { Metadata } from 'next';
import { drupal } from '@/lib/drupal';
import { notFound } from 'next/navigation';

interface ArticlePageProps {
  params: { slug: string[] };
}

// Static generation with ISR
export async function generateStaticParams() {
  const articles = await drupal.getResourceCollection('node--article', {
    params: {
      'fields[node--article]': 'title,path',
    },
  });

  return articles.map((article) => ({
    slug: article.path.alias.split('/').filter(Boolean),
  }));
}

// Metadata for SEO
export async function generateMetadata(
  { params }: ArticlePageProps
): Promise<Metadata> {
  const path = `/articles/${params.slug.join('/')}`;
  const article = await drupal.getResourceFromContext('node--article', {
    path,
  });

  if (!article) return { title: 'Not Found' };

  return {
    title: article.title,
    description: article.body?.summary || article.body?.value.substring(0, 160),
    openGraph: {
      title: article.title,
      images: article.field_image?.uri?.url
        ? [`https://headyme.com${article.field_image.uri.url}`]
        : [],
    },
  };
}

// Page component
export default async function ArticlePage({ params }: ArticlePageProps) {
  const path = `/articles/${params.slug.join('/')}`;
  
  const article = await drupal.getResourceFromContext('node--article', {
    path,
    params: {
      include: 'field_image,uid',
    },
  });

  if (!article) notFound();

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-heady-cyan mb-4 animate-breathing">
        {article.title}
      </h1>
      
      {article.field_image && (
        <img
          src={`https://headyme.com${article.field_image.uri.url}`}
          alt={article.field_image.alt || article.title}
          className="w-full h-auto rounded-organic shadow-lg mb-6"
          loading="lazy"
        />
      )}
      
      <div
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: article.body?.processed }}
      />
    </article>
  );
}

// ISR: Revalidate every 60 seconds
export const revalidate = 60;
```

## Part 7: Health Check API Route

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { checkDrupalHealth } from '@/lib/drupal';

export async function GET() {
  const drupalHealthy = await checkDrupalHealth();
  
  const health = {
    ok: drupalHealthy,
    service: 'heady-nextjs-frontend',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      drupal: drupalHealthy,
      memory: process.memoryUsage().heapUsed < 200 * 1024 * 1024, // < 200MB
    },
  };

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
```

## Part 8: Render Service Management

Create `scripts/render-manager.ts`:

```typescript
import fetch from 'node-fetch';

const RENDER_API_KEY = process.env.RENDER_API_KEY!;
const RENDER_API_BASE = 'https://api.render.com/v1';

interface RenderService {
  id: string;
  name: string;
  type: string;
  repo: string;
  branch: string;
  autoDeploy: boolean;
  serviceDetails: {
    url: string;
    buildCommand?: string;
    startCommand?: string;
  };
}

class RenderManager {
  private headers = {
    'Authorization': `Bearer ${RENDER_API_KEY}`,
    'Content-Type': 'application/json',
  };

  async listServices(): Promise<RenderService[]> {
    const response = await fetch(`${RENDER_API_BASE}/services`, {
      headers: this.headers,
    });
    
    if (!response.ok) throw new Error(`Render API error: ${response.statusText}`);
    
    const data = await response.json() as { data: RenderService[] };
    return data.data;
  }

  async deployService(serviceName: string): Promise<void> {
    const services = await this.listServices();
    const service = services.find(s => s.name === serviceName);
    
    if (!service) throw new Error(`Service not found: ${serviceName}`);

    const response = await fetch(`${RENDER_API_BASE}/services/${service.id}/deploys`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ clearCache: 'clear' }),
    });

    if (!response.ok) throw new Error(`Deploy failed: ${response.statusText}`);
    
    console.log(`✅ Deployed ${serviceName}`);
  }

  async updateServiceEnv(serviceId: string, envVars: Record<string, string>): Promise<void> {
    const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/env-vars`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(
        Object.entries(envVars).map(([key, value]) => ({ key, value }))
      ),
    });

    if (!response.ok) throw new Error(`Update env vars failed: ${response.statusText}`);
    
    console.log(`✅ Updated environment variables for service ${serviceId}`);
  }
}

// CLI usage
const manager = new RenderManager();

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  switch (command) {
    case 'list':
      const services = await manager.listServices();
      console.table(services.map(s => ({
        name: s.name,
        type: s.type,
        url: s.serviceDetails.url,
        autoDeploy: s.autoDeploy,
      })));
      break;

    case 'deploy':
      if (!arg) throw new Error('Service name required');
      await manager.deployService(arg);
      break;

    default:
      console.log('Usage: npm run render [list|deploy] [service-name]');
  }
}

main().catch(console.error);
```

## Part 9: Complete render.yaml

Create `render.yaml`:

```yaml
services:
  # Next.js Frontend (Optimized)
  - type: web
    name: heady-nextjs-frontend
    runtime: node
    repo: https://github.com/HeadyMe/headyconnection-web
    branch: main
    buildCommand: npm ci && npm run build
    startCommand: npm start
    plan: starter
    region: oregon
    envVars:
      - key: NEXT_PUBLIC_DRUPAL_BASE_URL
        value: https://headyme.com
      - key: NEXT_PUBLIC_API_BASE_URL
        value: https://headyme.com
      - key: DRUPAL_CLIENT_ID
        sync: false
      - key: DRUPAL_CLIENT_SECRET
        sync: false
      - key: DRUPAL_PREVIEW_SECRET
        sync: false
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      # Performance tuning for Render
      - key: NODE_OPTIONS
        value: "--max-old-space-size=460"  # Render starter tier: 512MB RAM
    healthCheckPath: /api/health
    domains:
      - headyme.com
    autoDeploy: true

databases:
  - name: heady-postgres
    databaseName: heady_production
    user: heady
    plan: starter  # 256MB RAM, 1GB storage
    region: oregon
    ipAllowList: []  # Allow all Render services
```

## Part 10: Mini-Computer Optimization

Create `docker-compose.minicomputer-optimized.yml`:

```yaml
# 🚀 Heady Mini-Computer Optimized Configuration
# Designed for resource-constrained edge devices

version: '3.8'

networks:
  heady-edge:
    driver: bridge
    internal: false

services:
  # 🧠 Heady Manager (Resource Optimized)
  heady-manager:
    build:
      context: ./Heady
      dockerfile: Dockerfile.manager
    container_name: heady-manager-edge
    restart: unless-stopped
    networks:
      heady-edge:
        ipv4_address: 172.26.0.10
    environment:
      - NODE_ENV=production
      - PORT=3300
      - HEADY_BASE_URL=https://headyme.com
      - NODE_OPTIONS=--max-old-space-size=256
    volumes:
      - heady-logs:/app/logs
    ports:
      - "3300:3300"
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3300/api/health"]
      interval: 60s
      timeout: 10s
      retries: 3

  # 🐍 Python Worker (Lightweight)
  python-worker:
    build:
      context: ./Heady
      dockerfile: Dockerfile.python
    container_name: heady-python-edge
    restart: unless-stopped
    networks:
      heady-edge:
        ipv4_address: 172.26.0.20
    environment:
      - PYTHONPATH=/app
      - MANAGER_URL=http://heady-manager:3300
    volumes:
      - heady-logs:/app/logs
    ports:
      - "5000:5000"
    depends_on:
      - heady-manager
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 60s
      timeout: 10s
      retries: 3

  # 💾 Redis Cache (Minimal)
  redis:
    image: redis:7-alpine
    container_name: heady-redis-edge
    restart: unless-stopped
    networks:
      heady-edge:
        ipv4_address: 172.26.0.30
    command: ["redis-server", "--maxmemory", "128mb", "--maxmemory-policy", "allkeys-lru"]
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    deploy:
      resources:
        limits:
          cpus: '0.2'
          memory: 128M
        reservations:
          cpus: '0.1'
          memory: 64M

volumes:
  redis-data:
    driver: local
  heady-logs:
    driver: local
```

## Part 11: Package.json Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "render": "tsx scripts/render-manager.ts",
    "deploy:render": "npm run render deploy",
    "deploy:edge": "docker-compose -f docker-compose.minicomputer-optimized.yml up -d",
    "health": "curl -f https://headyme.com/api/health"
  }
}
```

## Part 12: Migration to HeadyMe

Create `scripts/migrate-to-headyme.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 Migrating Heady infrastructure to HeadyMe organization..."

# Step 1: Transfer GitHub repositories
echo "📦 Transferring repositories..."
gh repo edit HeadyConnection/headyconnection-web --transfer-owner HeadyMe
gh repo edit HeadyConnection/headyconnection-drupal --transfer-owner HeadyMe

# Step 2: Update git remotes locally
echo "🔗 Updating git remotes..."
cd ../headyconnection-web
git remote set-url origin git@github.com:HeadyMe/headyconnection-web.git

cd ../headyconnection-drupal
git remote set-url origin git@github.com:HeadyMe/headyconnection-drupal.git

# Step 3: Update Render service repositories
echo "☁️  Updating Render service configurations..."
RENDER_API_KEY=$(heady-secrets get --key RENDER_API_KEY --environment production)

# Update Next.js frontend service
curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-nextjs-frontend)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repo": "https://github.com/HeadyMe/headyconnection-web",
    "branch": "main"
  }'

echo "✅ Migration to HeadyMe completed!"
```

## Part 13: Coding Agent Instructions

Create `CODING_AGENT_PROMPT.md`:

```markdown
# Heady Next.js Frontend Coding Agent Instructions

## CRITICAL RULES (NEVER VIOLATE)

1. **ZERO LOCALHOST**: NEVER use localhost, 127.0.0.1, 0.0.0.0 in ANY code
2. **PRODUCTION DOMAINS ONLY**: Always use headyme.com, chat.headyme.com
3. **ADMIN UI LOCATION**: Admin UI goes at headyme.com/admin-ui.html
4. **PUBLIC-FACING ONLY**: All endpoints must be internet accessible
5. **OPTIMIZE FOR MINI-COMPUTERS**: Resource constraints are critical

## DOMAIN STANDARDS
- Main Site: https://headyme.com
- Admin UI: https://headyme.com/admin-ui.html  
- Chat: https://headyme.com (or chat.headyme.com if needed)
- Manager: http://manager.headyme.com (internal services)

## REQUIRED PATTERNS
```typescript
// ✅ CORRECT: Production domains
const apiUrl = 'https://headyme.com/api/drupal-jsonapi';

// ❌ FORBIDDEN: Localhost
const apiUrl = 'http://localhost:3000/api';
```

## OPTIMIZATION REQUIREMENTS
- ISR (Incremental Static Regeneration) for all content pages
- Image optimization with proper domains
- Minimal bundle size for edge deployment
- Health check endpoints for monitoring
- Error boundaries for graceful degradation

## FILE STRUCTURE
```
src/
├── app/
│   ├── (pages)/
│   ├── api/
│   │   └── health/
│   └── articles/[...slug]/
├── components/
│   ├── ui/
│   └── layout/
├── lib/
│   ├── drupal.ts
│   └── utils.ts
└── styles/
    └── heady-theme.ts
```

## DEPLOYMENT WORKFLOW
1. Make changes in feature branch
2. Test locally: npm run dev
3. Build: npm run build  
4. Deploy to Render: npm run deploy:render
5. Verify health: npm run health

## COMMON TASKS
Create new page with Drupal data:
```typescript
export default async function Page({ params }) {
  const resource = await drupal.getResourceFromContext(params.path, context);
  return <Component>{resource}</Component>;
}
export const revalidate = 60; // ISR
```

Add new API route:
```typescript
export async function GET() {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600' }
  });
}
```

## TESTING REQUIREMENTS
- Unit tests for all utilities
- Integration tests for API routes
- E2E tests for critical user flows
- Performance tests for bundle size

## SECURITY REQUIREMENTS
- No hardcoded secrets (use environment variables)
- CSRF protection for all mutations
- Rate limiting on API endpoints
- Content Security Policy headers

Remember: User is EXTREMELY angry about localhost usage. Double-check all domain references before committing.
```

This comprehensive guide provides everything needed to build a production-optimized Next.js frontend that:
- Uses proper headyme.com domains (ZERO localhost)
- Optimizes for mini-computer deployment
- Manages Render services programmatically  
- Migrates to HeadyMe organization
- Follows Heady's Sacred Geometry principles
- Includes complete coding agent instructions
