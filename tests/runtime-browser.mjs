// Real-browser checks of the canonical zero-operation broker and built HTTP entry.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { verifyRuntimeSource } from '../scripts/runtime-source.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const site = resolve('dist/site'), requests = [], errors = [], consoleErrors = [];
let invalidDescriptor = false;
const csp = (await readFile(resolve(site, '_headers'), 'utf8')).match(/Content-Security-Policy: (.+)/)[1];
const fixture = '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><script type="module" src="/runtime-fixture.mjs"></script></body></html>';
const fixtureModule = `import { createLabClientRuntime } from './client-runtime-host.mjs';
import { LAB_CLIENT_DESCRIPTOR } from './client-runtime-descriptor.mjs';
globalThis.testRuntime = createLabClientRuntime();
globalThis.testFactory = createLabClientRuntime;
globalThis.testDescriptor = LAB_CLIENT_DESCRIPTOR;`;
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://fixture.local').pathname;
  requests.push(path);
  response.setHeader('Content-Security-Policy', csp); response.setHeader('Cache-Control', 'no-store');
  if (path === '/runtime-fixture.html' || path === '/runtime-fixture.mjs') {
    response.setHeader('Content-Type', path.endsWith('.mjs') ? 'text/javascript' : 'text/html; charset=utf-8');
    response.end(path.endsWith('.mjs') ? fixtureModule : fixture); return;
  }
  if (path === '/forbidden') { response.end('unexpected request'); return; }
  if (!/^\/[A-Za-z0-9./_-]*$/.test(path) || path.split('/').includes('..')) { response.writeHead(400).end(); return; }
  try {
    let bytes = await readFile(resolve(site, '.' + (path === '/' ? '/index.html' : path)));
    if (invalidDescriptor && path === '/client-runtime-descriptor.mjs') bytes = Buffer.from(bytes.toString().replace('kotoba.app.client-runtime.v1', 'invalid.runtime'));
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || (path === '/' ? 'text/html; charset=utf-8' : 'application/octet-stream'));
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(origin); await page.locator('.weight-row').first().waitFor();
  assert.equal(await page.locator('html').getAttribute('data-client-runtime'), 'validated');
  assert.equal(await page.locator('html').getAttribute('data-client-runtime-operations'), '0');
  await page.locator('#lang-ja').click(); await page.getByRole('button', { name: '赤い を編集', exact: true }).click(); await page.locator('#bold').click();
  assert.match(await page.locator('#focus-label').innerText(), /性質・色/);
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);

  await page.goto(origin + '/runtime-fixture.html'); await page.waitForFunction(() => Boolean(globalThis.testRuntime));
  const refusal = await page.evaluate(async () => {
    const runtime = globalThis.testRuntime;
    const attempts = [];
    for (const selector of [{}, { capability: 'net/http-get', service: 'fixture', operation: 'read' }, { capability: 'net/http-post', service: 'app-origin', operation: 'write', approved: true }]) {
      try { await runtime.invoke(selector, { input: location.origin + '/forbidden', approved: true }); attempts.push('unexpected success'); }
      catch (error) { attempts.push(error.message); }
    }
    let malformed;
    try { globalThis.testFactory({ ...globalThis.testDescriptor, schema: 'fake' }); malformed = 'unexpected success'; }
    catch (error) { malformed = error.message; }
    return { operations: runtime.operations.length, frozen: Object.isFrozen(runtime.operations), attempts, malformed, openDialogs: document.querySelectorAll('dialog[open]').length };
  });
  assert.equal(refusal.operations, 0); assert.equal(refusal.frozen, true); assert.equal(refusal.openDialogs, 0);
  assert.ok(refusal.attempts.every(message => /not eligible and supported/.test(message)));
  assert.match(refusal.malformed, /invalid-schema/);
  assert.equal(requests.filter(path => path === '/forbidden').length, 0);
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);

  // Attempt an app-origin fetch outside the broker. Verify the actual local server receives nothing.
  const blocked = await page.evaluate(async () => { try { await fetch(location.origin + '/forbidden'); return false; } catch { return true; } });
  assert.equal(blocked, true); assert.equal(requests.filter(path => path === '/forbidden').length, 0);
  assert.ok(consoleErrors.length > 0 && consoleErrors.every(message => /Content Security Policy|Refused to connect|violates|connect-src/.test(message)));

  invalidDescriptor = true;
  const invalid = await browser.newPage(), invalidErrors = [];
  invalid.on('pageerror', error => invalidErrors.push(error.message));
  await invalid.goto(origin); await invalid.getByRole('alert').waitFor();
  assert.equal(await invalid.locator('.weight-row').count(), 0);
  assert.equal(await invalid.locator('html').getAttribute('data-client-runtime'), null);
  assert.ok(invalidErrors.some(message => /invalid-schema/.test(message)));
  const { lock } = await verifyRuntimeSource();
  const report = { sourceRevision: lock.revision, sourceSha256: lock.sha256, httpEntry: 'pass', zeroOperationBroker: refusal,
    directFetchBlocked: blocked, forbiddenRequestsReceived: 0, malformedStartup: 'refused before app handlers', limitation: 'zero-operation trusted-page candidate; not general hostile-script isolation' };
  const output = resolve(process.env.TEST_ARTIFACTS || 'dist/runtime-browser'); await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'runtime-browser.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: built HTTP entry, canonical zero-operation broker, undeclared/forged invocation refusal, direct app-origin CSP refusal, malformed startup');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
