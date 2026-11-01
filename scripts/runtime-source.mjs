import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const sha256Hex = bytes => createHash('sha256').update(bytes).digest('hex');

export async function readRuntimeLock(root = repositoryRoot) {
  const lock = JSON.parse(await readFile(resolve(root, 'runtime-source.json'), 'utf8'));
  if (lock.schema !== 'kotoba-topology.runtime-source.v1' || lock.repository !== 'kotoba-lang/kotoba'
      || !/^[a-f0-9]{40}$/.test(lock.revision)
      || lock.path !== 'lib/kotoba.wasmWebcomponent/src/kotoba-client-runtime.js'
      || lock.license?.path !== 'lib/kotoba.wasmWebcomponent/LICENSE') throw new Error('runtime source must name the immutable canonical owner');
  for (const pin of [lock, lock.license]) {
    if (!/^[a-f0-9]{64}$/.test(pin.sha256) || !Number.isSafeInteger(pin.bytes) || pin.bytes < 1) throw new Error('runtime source requires digest and byte-length pins');
  }
  return lock;
}

export function checkPinnedBytes(bytes, pin, name) {
  if (bytes.byteLength !== pin.bytes || sha256Hex(bytes) !== pin.sha256) throw new Error(`${name} digest/length mismatch; build refused`);
}

export async function verifyRuntimeSource(root = repositoryRoot) {
  const lock = await readRuntimeLock(root);
  const runtime = await readFile(resolve(root, 'web/vendor/kotoba-client-runtime.js'));
  const license = await readFile(resolve(root, 'web/vendor/LICENSE'));
  checkPinnedBytes(runtime, lock, 'canonical runtime'); checkPinnedBytes(license, lock.license, 'canonical license');
  return { lock, runtime, license };
}
