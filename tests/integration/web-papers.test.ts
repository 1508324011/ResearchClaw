import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { createResearchClawServerApp } from '../../src/server/app';
import {
  ImportPaperResponseSchema,
  ListPapersResponseSchema,
} from '../../src/shared/contracts/papers';
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

describe('web papers routes', () => {
  it('lists papers in the browser client contract shape', async () => {
    const papersService = new PapersService();
    await papersService.create({
      title: 'Graph Transformers for Retrieval',
      source: 'manual',
      authors: ['Ada Lovelace'],
      tags: ['graph'],
      year: 2025,
      abstract: 'A graph retrieval paper.',
    });

    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/papers?q=graph`);

    expect(response.status).toBe(200);
    const payload = ListPapersResponseSchema.parse(await response.json());
    expect(payload.total).toBe(1);
    expect(payload.items).toEqual([
      expect.objectContaining({
        title: 'Graph Transformers for Retrieval',
        authors: ['Ada Lovelace'],
        tagNames: ['graph'],
        year: 2025,
      }),
    ]);
  });

  it('imports an identifier through the browser papers import alias', async () => {
    const { baseUrl } = await startServer();
    const realFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.startsWith(baseUrl)) {
        return realFetch(input, init);
      }

      if (url === 'https://arxiv.org/abs/2401.01234') {
        return new Response(
          `<!doctype html><html><head><title>[2401.01234] Retrieval-Augmented Planning</title><meta name="citation_author" content="Ada Lovelace"><meta name="citation_author" content="Grace Hopper"><meta name="citation_abstract" content="A planning paper."></head><body></body></html>`,
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        );
      }

      if (url === 'https://arxiv.org/pdf/2401.01234.pdf') {
        return new Response(new Uint8Array(Buffer.from('%PDF-1.4 arxiv content')), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    try {
      const response = await fetch(`${baseUrl}/papers/import`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: '2401.01234', kind: 'arxiv' }),
      });

      expect(response.status).toBe(200);
      const payload = ImportPaperResponseSchema.parse(await response.json());
      expect(payload.paper.shortId).toBe('2401.01234');
      expect(payload.paper.title).toBe('Retrieval-Augmented Planning');
      expect(payload.jobId).toBeTruthy();
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
