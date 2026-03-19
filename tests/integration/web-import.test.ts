import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createResearchClawServerApp } from '../../src/server/app';
import { ImportPaperResponseSchema } from '../../src/shared/contracts/papers';
import { closeTestDatabase, ensureTestDatabaseSchema, resetTestDatabase } from '../support/test-db';
import { TEST_STORAGE_DIR } from '../support/test-env';
import { PapersService } from '../../src/main/services/papers.service';

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

function getAcceptHeader(init?: RequestInit): string | null {
  if (!init?.headers) {
    return null;
  }

  return new Headers(init.headers).get('accept');
}

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

describe('web import routes', () => {
  it('imports an uploaded PDF into server-owned storage', async () => {
    const { baseUrl } = await startServer();
    const formData = new FormData();
    formData.set(
      'file',
      new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' }),
      'attention-is-all-you-need.pdf',
    );

    const response = await fetch(`${baseUrl}/import/pdf`, {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(200);
    const payload = ImportPaperResponseSchema.parse(await response.json());
    expect(payload.paper.title).toBe('attention is all you need');
    expect(payload.paper.shortId).toBeTruthy();

    const shortId = payload.paper.shortId!;
    const papersService = new PapersService();
    const storedPaper = await papersService.getByShortId(shortId);
    expect(storedPaper?.title).toBe('attention is all you need');
    expect(storedPaper?.tagNames).toContain('pdf');

    const expectedPdfPath = path.join(TEST_STORAGE_DIR, 'papers', shortId, 'paper.pdf');
    expect(fs.existsSync(expectedPdfPath)).toBe(true);
  });

  it('imports an arXiv identifier into server-owned storage', async () => {
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
      const response = await fetch(`${baseUrl}/import/identifier`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: '2401.01234', kind: 'arxiv' }),
      });

      expect(response.status).toBe(200);
      const payload = ImportPaperResponseSchema.parse(await response.json());
      expect(payload.paper.shortId).toBe('2401.01234');
      expect(payload.paper.title).toBe('Retrieval-Augmented Planning');

      const papersService = new PapersService();
      const storedPaper = await papersService.getByShortId('2401.01234');
      expect(storedPaper?.authors).toEqual(['Ada Lovelace', 'Grace Hopper']);

      const expectedPdfPath = path.join(TEST_STORAGE_DIR, 'papers', '2401.01234', 'paper.pdf');
      expect(fs.existsSync(expectedPdfPath)).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('imports a DOI into a complete readable paper when metadata and document acquisition succeed', async () => {
    const { baseUrl } = await startServer();
    const realFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.startsWith(baseUrl)) {
        return realFetch(input, init);
      }

      if (url === 'https://doi.org/10.1000/test-doi') {
        const acceptHeader = getAcceptHeader(init);

        if (acceptHeader?.includes('application/vnd.citationstyles.csl+json')) {
          return new Response(
            JSON.stringify({
              title: 'Retrieval-Augmented Planning via DOI',
              author: [
                { given: 'Ada', family: 'Lovelace' },
                { given: 'Grace', family: 'Hopper' },
              ],
              abstract: 'A planning paper discovered through DOI metadata.',
              issued: { 'date-parts': [[2024, 3, 14]] },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/vnd.citationstyles.csl+json' },
            },
          );
        }

        return new Response(
          `<!doctype html><html><head><title>Retrieval-Augmented Planning via DOI</title><meta name="citation_title" content="Retrieval-Augmented Planning via DOI"><meta name="citation_author" content="Ada Lovelace"><meta name="citation_author" content="Grace Hopper"><meta name="citation_abstract" content="A planning paper discovered through DOI metadata."><meta name="citation_pdf_url" content="https://publisher.example/test-doi.pdf"></head><body></body></html>`,
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        );
      }

      if (url === 'https://publisher.example/test-doi.pdf') {
        return new Response(new Uint8Array(Buffer.from('%PDF-1.4 doi content')), {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    try {
      const response = await fetch(`${baseUrl}/import/identifier`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: '10.1000/test-doi', kind: 'doi' }),
      });

      expect(response.status).toBe(200);
      const payload = ImportPaperResponseSchema.parse(await response.json());
      expect(payload.paper.title).toBe('Retrieval-Augmented Planning via DOI');
      expect(payload.paper.authors).toEqual(['Ada Lovelace', 'Grace Hopper']);
      expect(payload.paper.abstract).toContain('planning');
      expect(payload.paper.sourceUrl).toBe('https://doi.org/10.1000/test-doi');

      const papersService = new PapersService();
      const storedPaper = await papersService.getById(payload.paper.id);
      expect(storedPaper?.title).toBe('Retrieval-Augmented Planning via DOI');
      expect(storedPaper?.abstract).toContain('planning');
      expect(storedPaper?.tagNames).toContain('doi');

      const expectedPdfPath = path.join(
        TEST_STORAGE_DIR,
        'papers',
        payload.paper.shortId ?? '',
        'paper.pdf',
      );
      expect(fs.existsSync(expectedPdfPath)).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('rejects DOI imports that cannot be enriched into a complete paper', async () => {
    const { baseUrl } = await startServer();
    const realFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url.startsWith(baseUrl)) {
        return realFetch(input, init);
      }

      if (url === 'https://doi.org/10.1000/incomplete-doi') {
        const acceptHeader = getAcceptHeader(init);

        if (acceptHeader?.includes('application/vnd.citationstyles.csl+json')) {
          return new Response(
            JSON.stringify({
              title: 'Incomplete DOI Result',
              author: [{ given: 'Ada', family: 'Lovelace' }],
              issued: { 'date-parts': [[2024, 1, 1]] },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/vnd.citationstyles.csl+json' },
            },
          );
        }

        return new Response(
          `<!doctype html><html><head><title>Incomplete DOI Result</title><meta name="citation_title" content="Incomplete DOI Result"></head><body></body></html>`,
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        );
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    try {
      const response = await fetch(`${baseUrl}/import/identifier`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value: '10.1000/incomplete-doi', kind: 'doi' }),
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: 'Unable to import DOI as a complete paper.',
      });

      const papersService = new PapersService();
      await expect(papersService.list({})).resolves.toHaveLength(0);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('rejects invalid identifier payloads with a 400 response', async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/import/identifier`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 12345, kind: 'arxiv' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid import identifier payload.',
    });
  });

  it('accepts realistic browser PDF uploads up to the web import ceiling', async () => {
    const { baseUrl } = await startServer();
    const formData = new FormData();
    formData.set(
      'file',
      new Blob([`%PDF-1.4 ${'x'.repeat(5 * 1024 * 1024)}`], { type: 'application/pdf' }),
      'realistic-paper.pdf',
    );

    const response = await fetch(`${baseUrl}/import/pdf`, {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(200);
    const payload = ImportPaperResponseSchema.parse(await response.json());
    expect(payload.paper.title).toBe('realistic paper');
  });

  it('rejects oversized PDF uploads with a 413 response', async () => {
    const { baseUrl } = await startServer();
    const formData = new FormData();
    formData.set(
      'file',
      new Blob([`%PDF-1.4 ${'x'.repeat(25 * 1024 * 1024 + 1)}`], { type: 'application/pdf' }),
      'oversized.pdf',
    );

    const response = await fetch(`${baseUrl}/import/pdf`, {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Request body exceeds the 25 MB upload limit.',
    });
  });
});
