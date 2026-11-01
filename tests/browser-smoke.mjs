// Install playwright-core outside the repo, then provide PLAYWRIGHT_MODULE if needed.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = resolve(process.env.TEST_ARTIFACTS || 'dist/browser-check');
await mkdir(output, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true, reducedMotion: 'reduce' });
const page = await context.newPage(), errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
const file = pathToFileURL(resolve('dist/index.html')).href;
const click = id => page.locator(`#${id}`).click();
const choose = text => page.getByRole('button', { name: `${text} を編集`, exact: true }).click();
const getText = id => page.locator(`#${id}`).textContent();
const endRange = async id => { await page.locator(`#${id}`).focus(); await page.keyboard.press('End'); };
try {
  await page.goto(file); await page.locator('.weight-row').first().waitFor();
  assert.match(await getText('focus-label'), /焦点未指定/);
  assert.equal(await page.locator('.weight-row').count(), 4);
  await choose('red'); await click('bold');
  assert.equal(await page.locator('.word.is-bold').innerText(), 'red\n04');
  assert.match(await getText('focus-label'), /性質・色/);
  assert.ok(parseFloat(await page.locator('[data-role="color"] .weight-number').innerText()) > 25);
  await click('italic'); await click('caps');
  assert.equal(await page.locator('.word.is-bold.is-italic > span').first().innerText(), 'RED');
  for (const id of ['pitch', 'energy', 'duration']) await endRange(id);
  assert.match(await getText('contribution'), /1.20/);
  await page.locator('#boundary').check();
  assert.equal(await page.locator('.prosody-boundary').count(), 1);
  assert.match(await getText('graph-metrics'), /句グループ2/);
  const savedWeights = await getText('weights');
  await click('save-link'); assert.match(page.url(), /#state=/);
  await page.reload(); await page.locator('.weight-row').first().waitFor();
  assert.equal(await getText('weights'), savedWeights);
  const downloadEvent = page.waitForEvent('download'); await click('export');
  const download = await downloadEvent; const downloadPath = resolve(output, 'experiment.json'); await download.saveAs(downloadPath);
  const data = JSON.parse(await readFile(downloadPath, 'utf8'));
  assert.equal(data.kind, 'illustrative-model-not-observed-data');
  assert.equal(data.state.cues[3].caps, true);
  await click('reset'); assert.equal(await page.locator('.is-emphasized').count(), 0);
  await page.locator('#example').selectOption('introduction'); await choose('Maya'); await click('bold');
  assert.match(await getText('operator'), /人物は Maya だけ/);
  await click('clear-word'); await choose('Ken'); await click('italic');
  assert.match(await getText('operator'), /相手は Ken だけ/);
  await click('lang-ja'); await choose('マヤ'); assert.equal(await page.locator('#caps').isDisabled(), true);
  await click('bold'); assert.match(await getText('operator'), /作用域は自動で移動しません/);
  await page.locator('#step').focus(); await page.keyboard.press('Home');
  assert.match(await getText('operator'), /保留/); assert.match(await getText('step-value'), /0 \/ 9/);
  assert.equal(await page.locator('#graph .focus-dot').count(), 0);
  await click('play'); await page.waitForFunction(() => document.querySelector('#step').value !== '0');
  await click('play'); assert.match(await page.locator('#play').getAttribute('aria-label'), /再生/);
  for (const language of ['en', 'ja']) {
    await click(`lang-${language}`);
    for (const example of ['purchase', 'introduction', 'agency', 'event']) {
      await page.locator('#example').selectOption(example); await click('demo');
      assert.ok(await page.locator('.is-emphasized').count() > 0);
      assert.ok(await page.locator('#alternatives .alt-chip').count() >= 3);
    }
  }
  await click('lang-en'); await page.locator('#example').selectOption('introduction');
  await choose('introduced'); await endRange('pitch');
  const before = await page.locator('#prosody').innerHTML();
  await page.locator('#syllable').selectOption('2');
  assert.notEqual(await page.locator('#prosody').innerHTML(), before);
  await click('listen'); assert.match(await getText('listen'), /止める/); await click('listen');
  await click('listen'); await click('bold'); assert.match(await getText('listen'), /試聴/);
  // Restore a legible representative experiment for visual QA.
  await page.locator('#example').selectOption('purchase'); await click('demo');
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.screenshot({ path: resolve(output, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(output, 'mobile.png'), fullPage: true });
  await click('lang-ja'); await choose('赤い'); await click('bold');
  await page.locator('#sentence button').first().focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#sentence button').first().getAttribute('aria-pressed'), 'true');
  await page.goto(file + '#state=%7Binvalid');
  assert.match(await getText('status'), /読み取れません/);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  console.log('PASS: desktop/mobile, 8 bilingual examples, typography/prosody, scope, prefixes, playback, JSON/hash, keyboard, malformed state, CSP and zero network requests.');
  console.log(`Screenshots and experiment JSON: ${output}`);
} finally { await browser.close(); }
