import '../support/electron-mock';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createResearchClawServerApp } from '../../src/server/app';
import { getServerConfig } from '../../src/server/config/server-config';

const activeServers = new Set<import('node:http').Server>();
const tempDirs = new Set<string>();

async function createTempWebRoot() {
  const webRootDir = await mkdtemp(path.join(tmpdir(), 'researchclaw-web-'));
  tempDirs.add(webRootDir);

  await mkdir(path.join(webRootDir, 'assets'), { recursive: true });
  await writeFile(
    path.join(webRootDir, 'index.html'),
    '<!doctype html><html><body><div id="root">researchclaw web runtime</div></body></html>',
    'utf-8',
  );
  await writeFile(path.join(webRootDir, 'assets', 'app.js'), 'console.log("web asset");', 'utf-8');

  return webRootDir;
}

async function startServer(
  overrides: Partial<ReturnType<typeof getServerConfig>> & { webRootDir?: string },
) {
  const config = {
    ...getServerConfig(),
    host: '127.0.0.1',
    port: 0,
    ...overrides,
  } as ReturnType<typeof getServerConfig> & { webRootDir?: string };

  const server = createResearchClawServerApp(config);
  activeServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
  };
}

afterEach(async () => {
  await Promise.all(
    Array.from(activeServers).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  activeServers.clear();

  await Promise.all(Array.from(tempDirs).map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.clear();

  delete process.env.RESEARCH_CLAW_HOST;
  delete process.env.RESEARCH_CLAW_STORAGE_DIR;
  delete process.env.RESEARCH_CLAW_WEB_ROOT_DIR;
});

describe('web docker runtime configuration', () => {
  it('loads docker-friendly defaults for single-user web deployment', () => {
    process.env.RESEARCH_CLAW_STORAGE_DIR = '/tmp/researchclaw-web-storage';

    const config = getServerConfig();

    expect(config).toMatchObject({
      host: '0.0.0.0',
      mode: 'single-user-first',
      storageDir: '/tmp/researchclaw-web-storage',
      webRootDir: expect.stringContaining('dist/web'),
    });
  });

  it('serves built web files and html fallbacks from the configured web root', async () => {
    const webRootDir = await createTempWebRoot();
    const { baseUrl } = await startServer({ webRootDir });

    const rootResponse = await fetch(`${baseUrl}/`, {
      headers: { accept: 'text/html' },
    });
    expect(rootResponse.status).toBe(200);
    expect(rootResponse.headers.get('content-type')).toContain('text/html');
    await expect(rootResponse.text()).resolves.toContain('researchclaw web runtime');

    const searchPageResponse = await fetch(`${baseUrl}/search`, {
      headers: { accept: 'text/html' },
    });
    expect(searchPageResponse.status).toBe(200);
    expect(searchPageResponse.headers.get('content-type')).toContain('text/html');
    await expect(searchPageResponse.text()).resolves.toContain('researchclaw web runtime');

    const jobsPageResponse = await fetch(`${baseUrl}/jobs`, {
      headers: { accept: 'text/html' },
    });
    expect(jobsPageResponse.status).toBe(200);
    expect(jobsPageResponse.headers.get('content-type')).toContain('text/html');
    await expect(jobsPageResponse.text()).resolves.toContain('researchclaw web runtime');

    const overviewPageResponse = await fetch(`${baseUrl}/papers/paper-1`, {
      headers: { accept: 'text/html' },
    });
    expect(overviewPageResponse.status).toBe(200);
    expect(overviewPageResponse.headers.get('content-type')).toContain('text/html');
    await expect(overviewPageResponse.text()).resolves.toContain('researchclaw web runtime');

    const assetResponse = await fetch(`${baseUrl}/assets/app.js`);
    expect(assetResponse.status).toBe(200);
    await expect(assetResponse.text()).resolves.toContain('web asset');
  });
});
