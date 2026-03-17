import '../support/electron-mock';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { getServerConfig } from '../../src/server/config/server-config';
import { createResearchClawServerApp } from '../../src/server/app';
import { startResearchClawServer } from '../../src/server';
import { closeTestDatabase, ensureTestDatabaseSchema, resetTestDatabase } from '../support/test-db';

const activeServers = new Set<import('node:http').Server>();

ensureTestDatabaseSchema();

async function startServer() {
  const server = createResearchClawServerApp();
  activeServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
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
  delete process.env.RESEARCH_CLAW_STORAGE_DIR;
});

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await closeTestDatabase();
});

describe('web server runtime', () => {
  it('loads single-user server config from RESEARCH_CLAW_STORAGE_DIR', () => {
    process.env.RESEARCH_CLAW_STORAGE_DIR = '/tmp/researchclaw-task3-storage';

    const config = getServerConfig();

    expect(config.storageDir).toBe('/tmp/researchclaw-task3-storage');
    expect(config.mode).toBe('single-user-first');
  });

  it('boots in-process and registers first-slice routes', async () => {
    process.env.RESEARCH_CLAW_STORAGE_DIR = '/tmp/researchclaw-task3-storage';

    const { baseUrl } = await startServer();

    const healthResponse = await fetch(`${baseUrl}/health`);
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toMatchObject({
      status: 'ok',
      mode: 'single-user-first',
      routes: ['/papers', '/reading', '/search', '/jobs'],
      storageDir: '/tmp/researchclaw-task3-storage',
    });

    const papersResponse = await fetch(`${baseUrl}/papers`);
    expect(papersResponse.status).toBe(200);
    await expect(papersResponse.json()).resolves.toMatchObject({ items: [], total: 0 });

    const readingResponse = await fetch(`${baseUrl}/reading/test-paper-id`);
    expect(readingResponse.status).toBe(404);
    await expect(readingResponse.json()).resolves.toMatchObject({ error: 'Paper not found' });

    const readingIndexResponse = await fetch(`${baseUrl}/reading`);
    expect(readingIndexResponse.status).toBe(404);
    await expect(readingIndexResponse.json()).resolves.toMatchObject({ error: 'Not found' });

    const searchResponse = await fetch(`${baseUrl}/search?q=transformer`);
    expect(searchResponse.status).toBe(200);
    await expect(searchResponse.json()).resolves.toMatchObject({
      mode: 'text',
      results: [],
      total: 0,
    });

    const jobsResponse = await fetch(`${baseUrl}/jobs`);
    expect(jobsResponse.status).toBe(200);
    await expect(jobsResponse.json()).resolves.toEqual([]);
  });

  it('cleans up the startup error listener after the server begins listening', async () => {
    const server = await startResearchClawServer({
      host: '127.0.0.1',
      port: 0,
      mode: 'single-user-first',
      storageDir: '/tmp/researchclaw-task3-storage',
    });

    activeServers.add(server);

    expect(server.listenerCount('error')).toBe(0);
  });
});
