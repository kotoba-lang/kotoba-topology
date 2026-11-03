// Explicit local-source staging only. There is no build-time or browser download fallback.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readRuntimeLock, checkPinnedBytes, repositoryRoot } from './runtime-source.mjs';

const sourceRepo = process.argv[2];
if (!sourceRepo) throw new Error('Usage: node scripts/vendor-runtime.mjs /path/to/kotoba');
const lock = await readRuntimeLock();
const git = promisify(execFile);
const readSource = async path => (await git('git', ['-C', resolve(sourceRepo), 'show', `${lock.revision}:${path}`], { encoding: 'buffer', maxBuffer: 1024 * 1024 })).stdout;
const runtime = await readSource(lock.path), license = await readSource(lock.license.path);
checkPinnedBytes(runtime, lock, 'canonical runtime'); checkPinnedBytes(license, lock.license, 'canonical license');
await mkdir(resolve(repositoryRoot, 'web/vendor'), { recursive: true });
await writeFile(resolve(repositoryRoot, 'web/vendor/kotoba-client-runtime.js'), runtime);
await writeFile(resolve(repositoryRoot, 'web/vendor/LICENSE'), license);
console.log(`Vendored canonical runtime byte-exact at ${lock.revision}: ${lock.sha256}`);
