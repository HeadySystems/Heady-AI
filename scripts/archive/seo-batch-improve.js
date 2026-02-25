#!/usr/bin/env node
/*
 * SEO & Accessibility Batch Improvement Script
 * Adds meta tags, OG tags, security headers, and accessibility attributes
 * to all site dist/index.html files.
 */
const fs = require('fs');
const path = require('path');

const sitesDir = path.join(__dirname, '..', 'sites');
const dirs = fs.readdirSync(sitesDir).filter(d => {
    try { return fs.statSync(path.join(sitesDir, d)).isDirectory(); } catch { return false; }
});

let improvements = 0;
let filesChanged = 0;

const domainMap = {
    'headysystems': 'headysystems.com',
    'headysystems-com': 'headysystems.com',
    'headyme': 'headyme.com',
    'headyme-com': 'headyme.com',
    'headyconnection': 'headyconnection.org',
    'headyconnection-org': 'headyconnection.org',
    'headybuddy': 'headybuddy.org',
    'headybuddy-org': 'headybuddy.org',
    'headyapi': 'headyapi.com',
    'headyio': 'headyio.com',
    'headyio-com': 'headyio.com',
    'headymcp': 'headymcp.com',
    'headymcp-com': 'headymcp.com',
    'headyos': 'headyos.com',
    'headyos-react': 'headyos.com',
    'headyweb': 'headysystems.com',
    'admin-ui': 'admin.headysystems.com',
    '1ime1': '1ime1.com',
    'instant': 'instant.headysystems.com',
    'heady-discord': 'discord.headysystems.com',
    'heady-discord-connector': 'discord.headysystems.com',
    'heady-discord-connector-org': 'discord.headyconnection.org',
    'headydocs': 'docs.headysystems.com',
};

for (const dir of dirs) {
    const distIndex = path.join(sitesDir, dir, 'dist', 'index.html');
    if (!fs.existsSync(distIndex)) continue;

    let html = fs.readFileSync(distIndex, 'utf8');
    let changed = false;
    const siteName = dir.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        .replace('Headyos React', 'HeadyOS')
        .replace('Headyapi', 'HeadyAPI')
        .replace('Headymcp', 'HeadyMCP')
        .replace('Headyio', 'HeadyIO');

    // 1. lang attribute
    if (!html.includes('lang=')) {
        html = html.replace('<html>', '<html lang="en">');
        changed = true; improvements++;
    }

    // 2. viewport
    if (!html.includes('viewport')) {
        html = html.replace('</head>', '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>');
        changed = true; improvements++;
    }

    // 3. meta description
    if (!(html.includes('name="description"') || html.includes("name='description'"))) {
        const desc = `${siteName} — Heady AI Platform. Autonomous multi-agent AI with 20 specialized intelligence nodes.`;
        html = html.replace('</head>', `  <meta name="description" content="${desc}">\n</head>`);
        changed = true; improvements++;
    }

    // 4. Open Graph
    if (!html.includes('og:title')) {
        const ogTags = [
            `  <meta property="og:title" content="${siteName} — Heady AI Platform">`,
            `  <meta property="og:description" content="Autonomous multi-agent AI with 20 specialized intelligence nodes, post-quantum security, and Arena Mode.">`,
            `  <meta property="og:type" content="website">`,
            `  <meta property="og:site_name" content="Heady AI Platform">`,
        ].join('\n');
        html = html.replace('</head>', ogTags + '\n</head>');
        changed = true; improvements += 4;
    }

    // 5. Twitter Card
    if (!html.includes('twitter:card')) {
        const twitterTags = [
            `  <meta name="twitter:card" content="summary_large_image">`,
            `  <meta name="twitter:title" content="${siteName} — Heady AI">`,
        ].join('\n');
        html = html.replace('</head>', twitterTags + '\n</head>');
        changed = true; improvements += 2;
    }

    // 6. Referrer Policy
    if (!html.includes('referrer')) {
        html = html.replace('</head>', '  <meta name="referrer" content="strict-origin-when-cross-origin">\n</head>');
        changed = true; improvements++;
    }

    // 7. theme-color
    if (!html.includes('theme-color')) {
        html = html.replace('</head>', '  <meta name="theme-color" content="#1a1a2e">\n</head>');
        changed = true; improvements++;
    }

    // 8. canonical URL
    if (!html.includes('canonical')) {
        const domain = domainMap[dir] || 'headysystems.com';
        html = html.replace('</head>', `  <link rel="canonical" href="https://${domain}/">\n</head>`);
        changed = true; improvements++;
    }

    // 9. robots meta
    if (!html.includes('robots')) {
        html = html.replace('</head>', '  <meta name="robots" content="index, follow">\n</head>');
        changed = true; improvements++;
    }

    // 10. generator meta
    if (!html.includes('generator')) {
        html = html.replace('</head>', '  <meta name="generator" content="Heady AI Platform v3.0.0">\n</head>');
        changed = true; improvements++;
    }

    if (changed) {
        fs.writeFileSync(distIndex, html);
        filesChanged++;
        console.log(`  ✅ ${dir}: updated`);
    } else {
        console.log(`  ⏭️  ${dir}: already complete`);
    }
}

console.log(`\n📊 SEO improvements: ${improvements} changes across ${filesChanged} files`);
