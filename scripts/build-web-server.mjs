#!/usr/bin/env node
import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const external = [
  'electron',
  'path',
  'fs',
  'os',
  'crypto',
  'child_process',
  'stream',
  'events',
  'util',
  'url',
  'http',
  'https',
  'net',
  'tls',
  'dns',
  'readline',
  'buffer',
  'assert',
  'module',
  'worker_threads',
  'perf_hooks',
  'zlib',
  'node:path',
  'node:fs',
  'node:os',
  'node:crypto',
  'node:child_process',
  'node:stream',
  'node:events',
  'node:util',
  'node:url',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'node:dns',
  'node:readline',
  'node:buffer',
  'node:assert',
  'node:module',
  'node:worker_threads',
  'node:perf_hooks',
  'node:zlib',
  'node:process',
  '@prisma/client',
  'sql.js',
  'pdf-parse',
  'ssh2',
  'cpu-features',
];

const alias = {
  '@shared': path.join(root, 'src/shared/index.ts'),
  '@db': path.join(root, 'src/db/index.ts'),
};

await build({
  entryPoints: [path.join(root, 'src/server/entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(root, 'dist/server/index.js'),
  external,
  alias,
  tsconfig: path.join(root, 'tsconfig.main.json'),
  sourcemap: false,
  logLevel: 'info',
});

console.log('Web server build complete.');
