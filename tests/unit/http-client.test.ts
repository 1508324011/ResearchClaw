import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  GetReadingDetailResponse,
  ImportPaperResponse,
  JobStatus,
  JobStreamEvent,
  ListPapersResponse,
  PaperSummary,
  SaveReadingNoteResponse,
  SearchResponse,
} from '@shared';

import { HttpClient } from '../../src/renderer/lib/http-client';
import { ElectronClient } from '../../src/renderer/lib/electron-client';
import type { ResearchClawClient } from '../../src/renderer/lib/researchclaw-client';
import {
  clearResearchClawClient,
  ipc,
  setResearchClawClient,
} from '../../src/renderer/hooks/use-ipc';

const baseUrl = 'http://localhost:3000/api';

function createPaperSummary(overrides: Partial<PaperSummary> = {}): PaperSummary {
  return {
    id: 'paper-1',
    shortId: '2503.00001',
    title: 'Test Paper',
    authors: ['Alice'],
    createdAt: '2026-03-17T00:00:00.000Z',
    updatedAt: '2026-03-17T00:00:00.000Z',
    ...overrides,
  };
}

function createMockClient() {
  const listPapers = vi.fn<ResearchClawClient['listPapers']>().mockResolvedValue({
    items: [createPaperSummary()],
    total: 1,
  } satisfies ListPapersResponse);
  const importByIdentifier = vi.fn<ResearchClawClient['importByIdentifier']>().mockResolvedValue({
    paper: createPaperSummary({ title: 'Imported Paper' }),
    jobId: 'job-1',
  } satisfies ImportPaperResponse);
  const getReadingDetail = vi.fn<ResearchClawClient['getReadingDetail']>().mockResolvedValue({
    paper: createPaperSummary(),
    note: null,
  } satisfies GetReadingDetailResponse);
  const saveReadingNote = vi.fn<ResearchClawClient['saveReadingNote']>().mockResolvedValue({
    note: {
      id: 'note-1',
      paperId: 'paper-1',
      title: 'Reading note',
      content: { Summary: 'A concise note.' },
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
    },
  } satisfies SaveReadingNoteResponse);
  const search = vi.fn<ResearchClawClient['search']>().mockResolvedValue({
    mode: 'text',
    results: [createPaperSummary({ title: 'Search Result' })],
    total: 1,
  } satisfies SearchResponse);
  const listJobStatus = vi.fn<ResearchClawClient['listJobStatus']>().mockResolvedValue([
    {
      jobId: 'job-1',
      kind: 'import',
      state: 'running',
      progress: 50,
      updatedAt: '2026-03-17T00:00:00.000Z',
    },
  ] satisfies JobStatus[]);
  const subscribeJobEvents = vi
    .fn<ResearchClawClient['subscribeJobEvents']>()
    .mockResolvedValue(() => undefined);

  const client: ResearchClawClient = {
    listPapers,
    importByIdentifier,
    getReadingDetail,
    saveReadingNote,
    search,
    listJobStatus,
    subscribeJobEvents,
  };

  return {
    client,
    spies: {
      listPapers,
      importByIdentifier,
      getReadingDetail,
      saveReadingNote,
      search,
      listJobStatus,
      subscribeJobEvents,
    },
  };
}

function stubWindow(electronAPI?: Window['electronAPI']) {
  vi.stubGlobal('window', electronAPI ? { electronAPI } : {});
}

afterEach(() => {
  clearResearchClawClient();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('HttpClient', () => {
  it('fetches paper list with query parameters', async () => {
    const mockResponse: ListPapersResponse = {
      items: [createPaperSummary({ year: 2025 })],
      total: 1,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const client = new HttpClient(baseUrl);
    const result = await client.listPapers({ q: 'test', year: 2025 });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/papers?q=test&year=2025`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('imports paper by identifier', async () => {
    const mockResponse: ImportPaperResponse = {
      paper: createPaperSummary({ title: 'Imported Paper' }),
      jobId: 'job-1',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const client = new HttpClient(baseUrl);
    const result = await client.importByIdentifier({ value: '10.1000/test', kind: 'doi' });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/papers/import`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches reading detail by paperId', async () => {
    const mockResponse: GetReadingDetailResponse = {
      paper: createPaperSummary(),
      note: null,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const client = new HttpClient(baseUrl);
    const result = await client.getReadingDetail({ paperId: 'paper-1' });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/reading/paper-1`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('saves reading note', async () => {
    const mockResponse: SaveReadingNoteResponse = {
      note: {
        id: 'note-1',
        paperId: 'paper-1',
        title: 'Reading note',
        content: { Summary: 'A concise note.' },
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T00:00:00.000Z',
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const client = new HttpClient(baseUrl);
    const result = await client.saveReadingNote({
      paperId: 'paper-1',
      title: 'Reading note',
      content: { Summary: 'A concise note.' },
    });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/reading/paper-1/notes`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('performs text search', async () => {
    const mockResponse: SearchResponse = {
      mode: 'text',
      results: [createPaperSummary({ title: 'Search Result' })],
      total: 1,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const client = new HttpClient(baseUrl);
    const result = await client.search({ query: 'test', limit: 10, mode: 'text' });

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/search?q=test&limit=10&mode=text`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('lists job status', async () => {
    const mockResponse: JobStatus[] = [
      {
        jobId: 'job-1',
        kind: 'import',
        state: 'running',
        progress: 50,
        updatedAt: '2026-03-17T00:00:00.000Z',
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const client = new HttpClient(baseUrl);
    const result = await client.listJobStatus();

    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/jobs`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('subscribes to job progress events via SSE', async () => {
    const mockEvents: JobStreamEvent[] = [
      {
        type: 'progress',
        job: {
          jobId: 'job-1',
          kind: 'import',
          state: 'running',
          progress: 50,
          updatedAt: '2026-03-17T00:00:00.000Z',
        },
      },
      {
        type: 'done',
        job: {
          jobId: 'job-1',
          kind: 'import',
          state: 'completed',
          progress: 100,
          updatedAt: '2026-03-17T00:00:10.000Z',
        },
      },
    ];

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`data: ${JSON.stringify(mockEvents[0])}\n\n`),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {not-json}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`data: ${JSON.stringify(mockEvents[1])}\n\n`),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }),
    );

    const client = new HttpClient(baseUrl);
    const events: JobStreamEvent[] = [];

    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const unsubscribe = await client.subscribeJobEvents('job-1', (event) => {
      events.push(event);
      if (events.length === mockEvents.length) {
        resolveDone();
      }
    });

    await done;
    unsubscribe();

    expect(events).toEqual(mockEvents);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/jobs/job-1/stream`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('parses SSE payloads separated by CRLF frames', async () => {
    const mockEvent: JobStreamEvent = {
      type: 'progress',
      job: {
        jobId: 'job-1',
        kind: 'import',
        state: 'running',
        progress: 75,
        updatedAt: '2026-03-17T00:00:00.000Z',
      },
    };

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`data: ${JSON.stringify(mockEvent)}\r\n\r\n`),
        })
        .mockResolvedValueOnce({ done: true, value: undefined }),
      releaseLock: vi.fn(),
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: vi.fn().mockReturnValue(mockReader),
        },
      }),
    );

    const client = new HttpClient(baseUrl);
    const events: JobStreamEvent[] = [];
    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const unsubscribe = await client.subscribeJobEvents('job-1', (event) => {
      events.push(event);
      resolveDone();
    });

    await done;
    unsubscribe();

    expect(events).toEqual([mockEvent]);
  });

  it('throws error on failed fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    const client = new HttpClient(baseUrl);

    await expect(client.listPapers({})).rejects.toThrow('HTTP 500: Internal Server Error');
  });
});

describe('use-ipc transport fallback', () => {
  it('rejects when preload is missing and no fallback client is configured', async () => {
    stubWindow();

    await expect(ipc.importByIdentifier({ value: '10.1000/test', kind: 'doi' })).rejects.toThrow(
      'IPC unavailable for channel "papers:importByIdentifier": Electron preload API not found.',
    );
  });

  it('uses the configured fallback client for supported first-slice channels', async () => {
    stubWindow();

    const { client, spies } = createMockClient();
    setResearchClawClient(client);

    const importResult = await ipc.importByIdentifier({ value: '10.1000/test', kind: 'doi' });
    const papers = await ipc.listPapers({ q: 'test' });
    const readingDetail = await ipc.getReadingDetail('paper-1');
    const noteResult = await ipc.saveReadingNote({
      paperId: 'paper-1',
      title: 'Reading note',
      content: { Summary: 'A concise note.' },
    });
    const searchResult = await ipc.searchPapers('test', 10);
    const jobs = await ipc.listImportStatus();

    expect(spies.importByIdentifier).toHaveBeenCalledWith({ value: '10.1000/test', kind: 'doi' });
    expect(importResult.paper.title).toBe('Imported Paper');

    expect(spies.listPapers).toHaveBeenCalledWith({ q: 'test' });
    expect(papers).toEqual([
      expect.objectContaining({
        id: 'paper-1',
        shortId: '2503.00001',
        title: 'Test Paper',
      }),
    ]);

    expect(spies.getReadingDetail).toHaveBeenCalledWith({ paperId: 'paper-1' });
    expect(readingDetail.paper.id).toBe('paper-1');

    expect(spies.saveReadingNote).toHaveBeenCalledWith({
      paperId: 'paper-1',
      title: 'Reading note',
      content: { Summary: 'A concise note.' },
    });
    expect(noteResult.note.id).toBe('note-1');

    expect(spies.search).toHaveBeenCalledWith({ query: 'test', limit: 10, mode: 'text' });
    expect(searchResult).toEqual({
      results: [
        {
          paperId: 'paper-1',
          title: 'Search Result',
          authors: [{ name: 'Alice' }],
          year: null,
          abstract: null,
          citationCount: 0,
          externalIds: { ArXiv: '2503.00001' },
          url: null,
        },
      ],
      total: 1,
    });

    expect(spies.listJobStatus).toHaveBeenCalledTimes(1);
    expect(jobs).toEqual([
      {
        jobId: 'job-1',
        kind: 'import',
        state: 'running',
        progress: 50,
        updatedAt: '2026-03-17T00:00:00.000Z',
      },
    ]);
  });

  it('routes job progress subscriptions through the configured fallback client', async () => {
    stubWindow();

    const progressEvent: JobStreamEvent = {
      type: 'progress',
      job: {
        jobId: 'job-1',
        kind: 'import',
        state: 'running',
        progress: 25,
        updatedAt: '2026-03-17T00:00:00.000Z',
      },
    };
    const unsubscribe = vi.fn();
    const { client, spies } = createMockClient();
    spies.subscribeJobEvents.mockImplementation(async (_jobId, onEvent) => {
      onEvent(progressEvent);
      return unsubscribe;
    });
    setResearchClawClient(client);

    const events: JobStreamEvent[] = [];
    const stop = ipc.onJobProgress('jobs:stream:job-1', (event) => {
      events.push(event as JobStreamEvent);
    });

    await Promise.resolve();
    stop();

    expect(spies.subscribeJobEvents).toHaveBeenCalledWith('job-1', expect.any(Function));
    expect(events).toEqual([progressEvent]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('still cleans up fallback job subscriptions when stopped before the async subscribe resolves', async () => {
    stubWindow();

    let resolveSubscription!: (cleanup: () => void) => void;
    const unsubscribe = vi.fn();
    const { client, spies } = createMockClient();
    spies.subscribeJobEvents.mockImplementation(
      () =>
        new Promise<() => void>((resolve) => {
          resolveSubscription = resolve;
        }),
    );
    setResearchClawClient(client);

    const stop = ipc.onJobProgress('jobs:stream:job-1', vi.fn());
    stop();
    resolveSubscription(unsubscribe);
    await Promise.resolve();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('prefers Electron preload over the configured fallback client when available', async () => {
    const invoke = vi.fn().mockResolvedValue({
      paper: createPaperSummary({ title: 'Electron Import' }),
      jobId: 'job-electron',
    });

    stubWindow({
      invoke,
      on: vi.fn(() => () => {}),
      off: vi.fn(),
      once: vi.fn(),
      readLocalFile: vi.fn(),
      windowClose: vi.fn(() => Promise.resolve()),
      windowMinimize: vi.fn(() => Promise.resolve()),
      windowMaximize: vi.fn(() => Promise.resolve()),
      windowIsMaximized: vi.fn(() => Promise.resolve(false)),
    });

    const { client, spies } = createMockClient();
    setResearchClawClient(client);

    const result = await ipc.importByIdentifier({ value: '10.1000/test', kind: 'doi' });

    expect(invoke).toHaveBeenCalledWith('papers:importByIdentifier', {
      value: '10.1000/test',
      kind: 'doi',
    });
    expect(spies.importByIdentifier).not.toHaveBeenCalled();
    expect(result.paper.title).toBe('Electron Import');
  });
});

describe('ElectronClient', () => {
  it('rejects non-text search modes explicitly', async () => {
    stubWindow({
      invoke: vi.fn(),
      on: vi.fn(() => () => {}),
      off: vi.fn(),
      once: vi.fn(),
      readLocalFile: vi.fn(),
      windowClose: vi.fn(() => Promise.resolve()),
      windowMinimize: vi.fn(() => Promise.resolve()),
      windowMaximize: vi.fn(() => Promise.resolve()),
      windowIsMaximized: vi.fn(() => Promise.resolve(false)),
    });

    const client = new ElectronClient();

    await expect(client.search({ query: 'transformer', mode: 'semantic' })).rejects.toThrow(
      'Electron transport currently supports text search only.',
    );
  });
});
