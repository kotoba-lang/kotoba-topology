import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = file => readFile(resolve(root, file), 'utf8');
const source = await load('web/index.html');
const css = await load('web/styles.css');
const modules = await Promise.all(['examples', 'model', 'app'].map(name => load(`web/${name}.mjs`)));
const script = modules.map(code => code.replace(/^import .+ from '.+';\n/gm, '').replace(/^export (?=(?:const|function) )/gm, '')).join('\n');
if (/<\/script/i.test(script) || /<\/style/i.test(css)) throw new Error('Unexpected inline closing tag');
const hash = value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
const policy = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(css)}; connect-src 'none'; img-src data:; base-uri 'none'; form-action 'none'`;
const html = source.replace(/content="default-src [^"]+"/, `content="${policy}"`)
  .replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="app.mjs"></script>', `<script type="module">${script}</script>`);
const destination = resolve(process.argv[2] ?? resolve(root, 'dist/index.html'));
await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, html);
console.log(`Built self-contained demo: ${destination} (${Buffer.byteLength(html)} bytes)`);
