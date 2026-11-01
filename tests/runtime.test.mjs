import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyRuntimeSource, readRuntimeLock, sha256Hex, repositoryRoot } from '../scripts/runtime-source.mjs';
import { LAB_CLIENT_DESCRIPTOR } from '../web/client-runtime-descriptor.mjs';
import { labRuntimePolicy } from '../web/client-runtime-host.mjs';
import { clientRuntimeProblems, clientRuntimeConnectSrc, effectiveClientOperations } from '../web/vendor/kotoba-client-runtime.js';

test('vendored bytes and license match the immutable source pins', async () => {
  const { lock, runtime } = await verifyRuntimeSource();
  assert.match(lock.revision, /^[0-9a-f]{40}$/); assert.equal(sha256Hex(runtime), lock.sha256);
  assert.equal(lock.reviewedBaseline.revision, '6f74fe21760a1c752a05340ffb52e69a38877874');
});
test('canonical runtime admits the actual volatile descriptor with no operation authority', () => {
  assert.deepEqual(clientRuntimeProblems(LAB_CLIENT_DESCRIPTOR), []);
  assert.equal(labRuntimePolicy(), "connect-src 'none'");
  assert.deepEqual(effectiveClientOperations(LAB_CLIENT_DESCRIPTOR), []);
  assert.throws(() => clientRuntimeConnectSrc(LAB_CLIENT_DESCRIPTOR, [], ['https://service.example']), /must be declared/);
});
test('malformed descriptors and undeclared authority cannot widen this product boundary', () => {
  assert.throws(() => labRuntimePolicy({ ...LAB_CLIENT_DESCRIPTOR, schema: 'fake' }), /invalid client runtime/);
  assert.throws(() => labRuntimePolicy({ ...LAB_CLIENT_DESCRIPTOR, 'local-state': { adapter: 'memory', schema: 'x', version: 1 } }), /zero-operation/);
  assert.throws(() => labRuntimePolicy({ ...LAB_CLIENT_DESCRIPTOR, profile: 'restricted-wasm-v1' }), /zero-operation/);
  const op = { capability: 'net/http-get', service: 'fixture', operation: 'read', consent: 'each-operation', 'data-categories': [], endpoint: { origin: 'https://service.example', method: 'GET', path: '/items' } };
  assert.throws(() => labRuntimePolicy({ ...LAB_CLIENT_DESCRIPTOR, operations: [op] }), /capability-not-requested/);
});
test('source or license tampering and moving source pins fail before canonical code is imported by a build', async () => {
  const artifacts = resolve(process.env.TEST_ARTIFACTS || resolve(repositoryRoot, 'dist/runtime-test'));
  await mkdir(artifacts, { recursive: true });
  const root = await mkdtemp(resolve(artifacts, 'pins-')); await mkdir(resolve(root, 'web/vendor'), { recursive: true });
  const lock = await readRuntimeLock(); const runtime = await readFile(resolve(repositoryRoot, 'web/vendor/kotoba-client-runtime.js'));
  const license = await readFile(resolve(repositoryRoot, 'web/vendor/LICENSE'));
  await writeFile(resolve(root, 'runtime-source.json'), JSON.stringify(lock));
  await writeFile(resolve(root, 'web/vendor/kotoba-client-runtime.js'), Buffer.concat([runtime, Buffer.from('\n// tampered')]));
  await writeFile(resolve(root, 'web/vendor/LICENSE'), license);
  await assert.rejects(verifyRuntimeSource(root), /runtime digest\/length mismatch/);
  await writeFile(resolve(root, 'web/vendor/kotoba-client-runtime.js'), runtime);
  await writeFile(resolve(root, 'web/vendor/LICENSE'), 'wrong license');
  await assert.rejects(verifyRuntimeSource(root), /license digest\/length mismatch/);
  await writeFile(resolve(root, 'runtime-source.json'), JSON.stringify({ ...lock, revision: 'main' }));
  await assert.rejects(verifyRuntimeSource(root), /immutable canonical owner/);
});
