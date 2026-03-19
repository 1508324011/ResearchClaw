import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createResearchClawServerApp } from '../../src/server/app';
import { GetPaperDetailResponseSchema } from '../../src/shared/contracts/papers';
import { PapersService } from '../../src/main/services/papers.service';
import { closeTestDatabase, ensureTestDatabaseSchema, resetTestDatabase } from '../support/test-db';
import { TEST_STORAGE_DIR } from '../support/test-env';

const activeServers = new Set<import('node:http').Server>();

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

ensureTestDatabaseSchema();

beforeEach(async () => {
  process.env.RESEARCH_CLAW_STORAGE_DIR = TEST_STORAGE_DIR;
  await resetTestDatabase();
  fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_STORAGE_DIR, { recursive: true });
});

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

afterAll(async () => {
  await closeTestDatabase();
});

describe('web paper detail routes', () => {
  it('returns a browser-safe paper detail response with a local PDF asset URL', async () => {
    const papersService = new PapersService();
    const sourcePdfPath = path.join(TEST_STORAGE_DIR, 'source-paper.pdf');
    fs.writeFileSync(sourcePdfPath, '%PDF-1.4 graph foundations content');

    const paper = await papersService.importLocalPdf(sourcePdfPath);
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/papers/${paper.id}`);

    expect(response.status).toBe(200);
    const payload = GetPaperDetailResponseSchema.parse(await response.json());
    expect(payload.paper.id).toBe(paper.id);
    expect(payload.paper.title).toBe('source paper');
    expect(payload.pdfUrl).toBe(`/papers/${paper.id}/pdf`);
  });

  it('serves the stored PDF asset for a paper from server-owned storage', async () => {
    const papersService = new PapersService();
    const sourcePdfPath = path.join(TEST_STORAGE_DIR, 'retrieval-workflow.pdf');
    fs.writeFileSync(sourcePdfPath, '%PDF-1.4 retrieval workflow content');

    const paper = await papersService.importLocalPdf(sourcePdfPath);
    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/papers/${paper.id}/pdf`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    const body = Buffer.from(await response.arrayBuffer()).toString('utf-8');
    expect(body).toContain('%PDF-1.4 retrieval workflow content');
  });
});
