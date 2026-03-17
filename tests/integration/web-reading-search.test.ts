import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import '../support/electron-mock';
import {
  GetReadingDetailResponseSchema,
  SaveReadingNoteResponseSchema,
  SearchResponseSchema,
} from '../../src/shared';
import { createResearchClawServerApp } from '../../src/server/app';
import { PapersService } from '../../src/main/services/papers.service';
import { ReadingService } from '../../src/main/services/reading.service';
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

describe('web reading and search routes', () => {
  it('returns a paper summary together with the latest paper reading note', async () => {
    const papersService = new PapersService();
    const readingService = new ReadingService();
    const paper = await papersService.create({
      title: 'Graph Transformers for Retrieval',
      authors: ['Ada Lovelace', 'Grace Hopper'],
      source: 'manual',
      sourceUrl: 'https://example.com/papers/graph-transformers',
      submittedAt: new Date('2024-01-02T00:00:00.000Z'),
      abstract: 'A paper about graph-aware retrieval.',
      tags: ['graphs', 'retrieval'],
    });

    await readingService.create({
      paperId: paper.id,
      type: 'paper',
      title: 'Older note',
      content: { summary: 'Outdated draft' },
    });

    const latestNote = await readingService.create({
      paperId: paper.id,
      type: 'paper',
      title: 'Structured summary',
      content: { summary: 'Latest reading card' },
    });

    await readingService.create({
      paperId: paper.id,
      type: 'paper',
      title: 'Chat: Graph Transformers for Retrieval',
      content: { messages: [] },
    });

    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/reading/${paper.id}`);

    expect(response.status).toBe(200);

    const payload = GetReadingDetailResponseSchema.parse(await response.json());
    expect(payload.paper.title).toBe('Graph Transformers for Retrieval');
    expect(payload.paper.authors).toEqual(['Ada Lovelace', 'Grace Hopper']);
    expect(payload.paper.year).toBe(2024);
    expect(payload.note).not.toBeNull();
    expect(payload.note?.id).toBe(latestNote.id);
    expect(payload.note?.title).toBe('Structured summary');
    expect(payload.note?.content).toEqual({ summary: 'Latest reading card' });
  });

  it('creates notes from the paper-scoped route and updates them through the alias route', async () => {
    const papersService = new PapersService();
    const paper = await papersService.create({
      title: 'Agentic Systems for Literature Review',
      authors: ['John McCarthy'],
      source: 'manual',
      sourceUrl: 'https://example.com/papers/agentic-systems',
      submittedAt: new Date('2023-08-19T00:00:00.000Z'),
      abstract: 'An overview of agentic systems for research workflows.',
      tags: ['agents'],
    });

    const { baseUrl } = await startServer();

    const createResponse = await fetch(`${baseUrl}/reading/${paper.id}/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        paperId: paper.id,
        title: 'Key takeaways',
        content: { summary: 'First pass' },
      }),
    });

    expect(createResponse.status).toBe(200);
    const created = SaveReadingNoteResponseSchema.parse(await createResponse.json());
    expect(created.note.paperId).toBe(paper.id);
    expect(created.note.title).toBe('Key takeaways');
    expect(created.note.content).toEqual({ summary: 'First pass' });

    const updateResponse = await fetch(`${baseUrl}/reading/note`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        paperId: paper.id,
        noteId: created.note.id,
        content: { summary: 'Updated pass' },
      }),
    });

    expect(updateResponse.status).toBe(200);
    const updated = SaveReadingNoteResponseSchema.parse(await updateResponse.json());
    expect(updated.note.id).toBe(created.note.id);
    expect(updated.note.content).toEqual({ summary: 'Updated pass' });

    const detailResponse = await fetch(`${baseUrl}/reading/${paper.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = GetReadingDetailResponseSchema.parse(await detailResponse.json());
    expect(detail.note?.id).toBe(created.note.id);
    expect(detail.note?.content).toEqual({ summary: 'Updated pass' });
  });

  it('returns text search results using the shared web contract', async () => {
    const papersService = new PapersService();
    await papersService.create({
      title: 'Graph Retrieval with Transformer Memories',
      authors: ['Ada Lovelace'],
      source: 'manual',
      sourceUrl: 'https://example.com/papers/graph-retrieval',
      submittedAt: new Date('2025-01-01T00:00:00.000Z'),
      abstract: 'Graph retrieval improved with transformer memories.',
      tags: ['graphs', 'retrieval'],
    });

    await papersService.create({
      title: 'Vision-Language Planning for Web Agents',
      authors: ['Alan Turing'],
      source: 'manual',
      sourceUrl: 'https://example.com/papers/vision-language',
      submittedAt: new Date('2022-05-08T00:00:00.000Z'),
      abstract: 'A different topic that should not match the query.',
      tags: ['vision'],
    });

    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/search?q=graph&limit=5&mode=text`);

    expect(response.status).toBe(200);
    const payload = SearchResponseSchema.parse(await response.json());
    expect(payload.mode).toBe('text');
    expect(payload.total).toBe(1);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]?.title).toBe('Graph Retrieval with Transformer Memories');
  });

  it('maps semantic fallback results back to real paper summary fields', async () => {
    const papersService = new PapersService();
    const paper = await papersService.create({
      title: 'Vector Fallback for Search',
      authors: ['Claude Shannon'],
      source: 'manual',
      sourceUrl: 'https://example.com/papers/vector-fallback',
      submittedAt: new Date('2021-04-11T00:00:00.000Z'),
      abstract: 'Semantic search should fall back to lexical search when the index is empty.',
      tags: ['vector'],
    });

    const { baseUrl } = await startServer();
    const response = await fetch(`${baseUrl}/search?q=vector&limit=5&mode=semantic`);

    expect(response.status).toBe(200);
    const payload = SearchResponseSchema.parse(await response.json());
    expect(payload.mode).toBe('text');
    expect(payload.total).toBe(1);
    expect(payload.results[0]).toMatchObject({
      id: paper.id,
      title: 'Vector Fallback for Search',
      year: 2021,
      createdAt: paper.createdAt.toISOString(),
      updatedAt: paper.updatedAt.toISOString(),
    });
  });
});
