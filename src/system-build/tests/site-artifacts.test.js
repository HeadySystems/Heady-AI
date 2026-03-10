import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const siteRoot = path.join(process.cwd(), 'apps', 'sites');
const expected = ['headyme','headysystems','heady-ai','headyos','headyconnection-org','headyconnection-com','headyex','headyfinance','admin-headysystems','auth-headysystems'];

test('all sites have index, robots, and sitemap artifacts', () => {
  for (const slug of expected) {
    const dir = path.join(siteRoot, slug);
    assert.ok(fs.existsSync(path.join(dir, 'index.html')), `${slug} missing index.html`);
    assert.ok(fs.existsSync(path.join(dir, 'robots.txt')), `${slug} missing robots.txt`);
    assert.ok(fs.existsSync(path.join(dir, 'sitemap.xml')), `${slug} missing sitemap.xml`);
  }
});

test('auth relay contains origin allowlist and nonce echo', () => {
  const relay = fs.readFileSync(path.join(siteRoot, 'auth-headysystems', 'relay.html'), 'utf8');
  assert.match(relay, /ALLOWED_ORIGINS/);
  assert.match(relay, /nonce/);
});

test('generated sites replace placeholder footer links and preserve section anchor targets', () => {
  const systemSite = fs.readFileSync(path.join(siteRoot, 'headysystems', 'index.html'), 'utf8');
  assert.doesNotMatch(systemSite, /href="#"/);
  assert.match(systemSite, /href="mailto:eric@headyconnection.org\?subject=Heady%20Careers"/);
  assert.match(systemSite, /id="cases"/);
  assert.match(systemSite, /id="contact"/);
});
