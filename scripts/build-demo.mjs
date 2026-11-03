import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { repositoryRoot, verifyRuntimeSource, sha256Hex } from './runtime-source.mjs';

const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const flattenProductModule = source => source.replace(/^import .+ from '.+';\n/gm, '').replace(/^export (?=(?:const|function) )/gm, '');

export async function buildDemo(destination, { root = repositoryRoot, siteDirectory = resolve(dirname(destination), 'site') } = {}) {
  // Verify before importing/executing canonical code. Execute captured verified bytes, not a second file read.
  const { lock, runtime, license } = await verifyRuntimeSource(root);
  const load = file => readFile(resolve(root, file), 'utf8');
  const names = ['client-runtime-descriptor', 'client-runtime-policy', 'client-runtime-host', 'examples', 'model', 'app'];
  const [source, css, ...modules] = await Promise.all([load('web/index.html'), load('web/styles.css'), ...names.map(name => load(`web/${name}.mjs`))]);
  const canonical = await import(dataModule(runtime));
  const { LAB_CLIENT_DESCRIPTOR } = await import(dataModule(modules[0]));
  const { labDescriptorPolicy } = await import(dataModule(modules[1]));
  const connectSrc = labDescriptorPolicy(canonical, LAB_CLIENT_DESCRIPTOR);
  // Preserve the complete canonical source byte-for-byte, including its exports.
  const script = runtime.toString('utf8') + '\n' + modules.map(flattenProductModule).join('\n');
  if (/<\/script/i.test(script) || /<\/style/i.test(css)) throw new Error('Unexpected inline closing tag');
  const hash = value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
  const policy = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(css)}; ${connectSrc}; img-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'`;
  const replacePolicy = (html, csp) => html.replace(/content="default-src [^"]+"/, `content="${csp}"`);
  const html = replacePolicy(source, policy).replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`)
    .replace('<script type="module" src="app.mjs"></script>', () => `<script type="module">${script}</script>`);
  const sitePolicy = `default-src 'none'; script-src 'self'; style-src 'self'; ${connectSrc}; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'`;
  const receipt = { schema: 'kotoba-topology.client-runtime-build.v1', source: lock,
    descriptor: LAB_CLIENT_DESCRIPTOR, descriptorSha256: sha256Hex(Buffer.from(JSON.stringify(LAB_CLIENT_DESCRIPTOR))),
    requestedCapabilities: [], eligibleOperations: [], hostSupportedOperations: [], connectSrc,
    qualification: 'pinned canonical candidate; browser-local, zero external operations; not hostile-script isolation or production release' };
  // No output is written until every pin, descriptor and product-boundary check passes.
  await mkdir(dirname(destination), { recursive: true }); await mkdir(resolve(siteDirectory, 'vendor'), { recursive: true });
  await writeFile(destination, html);
  await writeFile(resolve(siteDirectory, 'index.html'), replacePolicy(source, sitePolicy));
  await writeFile(resolve(siteDirectory, 'styles.css'), css);
  for (const [i, name] of names.entries()) await writeFile(resolve(siteDirectory, `${name}.mjs`), modules[i]);
  await writeFile(resolve(siteDirectory, 'vendor/kotoba-client-runtime.js'), runtime);
  await writeFile(resolve(siteDirectory, 'vendor/LICENSE'), license);
  await writeFile(resolve(siteDirectory, '_headers'), `/*\n  Content-Security-Policy: ${sitePolicy}\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n`);
  await writeFile(resolve(dirname(destination), 'client-runtime-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Built canonical-runtime demo: ${destination} (${Buffer.byteLength(html)} bytes), static site: ${siteDirectory}`);
  return { destination, siteDirectory, receipt };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await buildDemo(resolve(process.argv[2] ?? resolve(repositoryRoot, 'dist/index.html')));
}
