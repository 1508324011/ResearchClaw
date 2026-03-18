import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

type RunningChild = {
  child: ChildProcessWithoutNullStreams;
  getStdout: () => string;
  getStderr: () => string;
};

function getTsxBin(cwd: string): string {
  const binName = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
  return path.join(cwd, 'node_modules', '.bin', binName);
}

async function buildWebServerBundle(cwd: string): Promise<void> {
  await execFileAsync(process.execPath, ['scripts/build-web-server.mjs'], {
    cwd,
    timeout: 20_000,
  });
}

async function startBuiltWebServer(
  cwd: string,
  storageDir: string,
  port: number,
): Promise<RunningChild> {
  const childEnv = {
    ...process.env,
    PORT: String(port),
    RESEARCH_CLAW_STORAGE_DIR: storageDir,
  };
  delete childEnv.DATABASE_URL;

  const child = spawn(process.execPath, ['dist/server/index.js'], {
    cwd,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  return await new Promise<RunningChild>((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill('SIGTERM');
      reject(
        new Error(
          `Timed out waiting for built web server startup.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        ),
      );
    }, 20_000);

    const finalizeFailure = (reason: string) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(new Error(`${reason}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    };

    child.once('error', (error) => {
      finalizeFailure(`Failed to start built web server process: ${error.message}`);
    });

    child.once('exit', (code, signal) => {
      finalizeFailure(`Built web server exited before readiness (code=${code}, signal=${signal})`);
    });

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();

      if (settled || !stdout.includes('ResearchClaw web server listening on')) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        child,
        getStdout: () => stdout,
        getStderr: () => stderr,
      });
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
  });
}

async function stopChildProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    child.once('exit', () => {
      resolve();
    });

    child.kill('SIGTERM');
  });
}

function getCurrentSchemaHash(repoRoot: string): string {
  const schema = readFileSync(path.join(repoRoot, 'prisma/schema.prisma'), 'utf-8');
  return createHash('sha256').update(schema).digest('hex');
}

async function seedValidSqliteDatabaseWithoutCoreTables(
  repoRoot: string,
  storageDir: string,
): Promise<void> {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs({
    locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`),
  });
  const db = new SQL.Database();

  db.run('CREATE TABLE bootstrap_marker (id INTEGER PRIMARY KEY, note TEXT NOT NULL);');
  db.run("INSERT INTO bootstrap_marker (note) VALUES ('stale database');");

  const dbPath = path.join(storageDir, 'researchclaw.db');
  const hashPath = path.join(storageDir, 'schema-hash.json');

  writeFileSync(dbPath, Buffer.from(db.export()));
  writeFileSync(hashPath, JSON.stringify({ hash: getCurrentSchemaHash(repoRoot) }), 'utf-8');
  db.close();
}

describe('web runtime pure node startup', () => {
  it('boots the web server without requiring Electron at startup', async () => {
    const repoRoot = process.cwd();
    const storageDir = mkdtempSync(path.join(tmpdir(), 'researchclaw-web-runtime-'));

    const script = String.raw`
      import { pathToFileURL } from 'node:url';

      void (async () => {
        const moduleUrl = pathToFileURL(process.cwd() + '/src/server/app.ts').href;
        const { createResearchClawServerApp } = await import(moduleUrl);

        const server = createResearchClawServerApp();

        await new Promise((resolve, reject) => {
          server.once('error', reject);
          server.listen(0, '127.0.0.1', resolve);
        });

        const address = server.address();
        if (!address || typeof address === 'string') {
          throw new Error('Expected an ephemeral TCP address.');
        }

        const response = await fetch('http://127.0.0.1:' + address.port + '/health');
        const body = await response.text();
        console.log(body);

        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(undefined);
          });
        });
      })().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    `;

    try {
      const { stdout, stderr } = await execFileAsync(getTsxBin(repoRoot), ['-e', script], {
        cwd: repoRoot,
        timeout: 20_000,
        env: {
          ...process.env,
          RESEARCH_CLAW_STORAGE_DIR: storageDir,
        },
      });

      expect(stderr).toBe('');
      expect(stdout).toContain('"status":"ok"');
      expect(stdout).toContain('"mode":"single-user-first"');
    } finally {
      rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it('boots the built web server bundle without requiring Electron at startup', async () => {
    const repoRoot = process.cwd();
    const storageDir = mkdtempSync(path.join(tmpdir(), 'researchclaw-web-dist-runtime-'));
    const port = 3900 + Math.floor(Math.random() * 1000);

    await buildWebServerBundle(repoRoot);

    const runningServer = await startBuiltWebServer(repoRoot, storageDir, port);

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain('"status":"ok"');
      expect(body).toContain('"mode":"single-user-first"');
      expect(runningServer.getStdout()).toContain(
        `ResearchClaw web server listening on http://0.0.0.0:${port}`,
      );
      expect(runningServer.getStderr()).toBe('');
    } finally {
      await stopChildProcess(runningServer.child);
      rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it('initializes the database before db-backed web routes handle requests', async () => {
    const repoRoot = process.cwd();
    const storageDir = mkdtempSync(path.join(tmpdir(), 'researchclaw-web-dist-db-init-'));
    const port = 4900 + Math.floor(Math.random() * 1000);

    await buildWebServerBundle(repoRoot);

    const runningServer = await startBuiltWebServer(repoRoot, storageDir, port);

    try {
      const papersResponse = await fetch(`http://127.0.0.1:${port}/papers?q=graph`);
      const papersBody = await papersResponse.json();
      const searchResponse = await fetch(
        `http://127.0.0.1:${port}/search?q=graph&limit=5&mode=text`,
      );
      const searchBody = await searchResponse.json();

      expect(papersResponse.status).toBe(200);
      expect(papersBody).toMatchObject({ total: 0, items: [] });
      expect(searchResponse.status).toBe(200);
      expect(searchBody).toMatchObject({ mode: 'text', total: 0, results: [] });
      expect(runningServer.getStderr()).toBe('');
    } finally {
      await stopChildProcess(runningServer.child);
      rmSync(storageDir, { recursive: true, force: true });
    }
  });

  it('does not skip database initialization when a stale schema hash exists without core tables', async () => {
    const repoRoot = process.cwd();
    const storageDir = mkdtempSync(path.join(tmpdir(), 'researchclaw-web-dist-stale-hash-'));
    const port = 5000 + Math.floor(Math.random() * 1000);

    await seedValidSqliteDatabaseWithoutCoreTables(repoRoot, storageDir);

    await buildWebServerBundle(repoRoot);

    const runningServer = await startBuiltWebServer(repoRoot, storageDir, port);

    try {
      const papersResponse = await fetch(`http://127.0.0.1:${port}/papers?q=graph`);
      const papersBody = await papersResponse.json();
      const searchResponse = await fetch(
        `http://127.0.0.1:${port}/search?q=graph&limit=5&mode=text`,
      );
      const searchBody = await searchResponse.json();
      const importResponse = await fetch(`http://127.0.0.1:${port}/papers/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: '2401.01234', kind: 'arxiv' }),
      });
      const importBody = await importResponse.json();

      expect(runningServer.getStdout()).toContain('running db push');
      expect(papersResponse.status).toBe(200);
      expect(papersBody).toMatchObject({ total: 0, items: [] });
      expect(searchResponse.status).toBe(200);
      expect(searchBody).toMatchObject({ mode: 'text', total: 0, results: [] });
      expect(importResponse.status).toBe(200);
      expect(importBody).toHaveProperty('paper.id');
      expect(importBody).toHaveProperty('jobId');
      expect(runningServer.getStderr()).toBe('');
    } finally {
      await stopChildProcess(runningServer.child);
      rmSync(storageDir, { recursive: true, force: true });
    }
  }, 30_000);
});
