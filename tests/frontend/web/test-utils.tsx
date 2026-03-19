import type {
  GetPaperDetailResponse,
  GetReadingDetailResponse,
  ImportPaperResponse,
  JobStatus,
  JobStreamEvent,
  PaperSummary,
  SaveReadingNoteRequest,
  SaveReadingNoteResponse,
  SearchResponse,
} from '@shared';
import { vi } from 'vitest';
import type { ResearchClawClient } from '../../../src/renderer/lib/researchclaw-client';

export function createPaperSummary(overrides: Partial<PaperSummary> = {}): PaperSummary {
  return {
    id: 'paper-1',
    shortId: '2503.00001',
    title: 'Graph Foundations',
    authors: ['Ada Lovelace'],
    abstract: 'A calm paper about graph retrieval.',
    tagNames: ['graph'],
    createdAt: '2026-03-17T00:00:00.000Z',
    updatedAt: '2026-03-17T00:00:00.000Z',
    ...overrides,
  };
}

interface MockClientOptions {
  papers?: PaperSummary[];
  searchResults?: PaperSummary[];
  readingDetail?: MockReadingDetail;
  importedPaper?: PaperSummary;
}

type MockReadingDetail = GetReadingDetailResponse & {
  pdfUrl?: string;
};

export function createMockClient(options: MockClientOptions = {}) {
  const papers = options.papers ?? [createPaperSummary()];
  const importedPaper =
    options.importedPaper ?? createPaperSummary({ id: 'paper-2', shortId: '2401.01234' });
  let readingDetail: MockReadingDetail = options.readingDetail ?? {
    paper: papers[0] ?? createPaperSummary(),
    note: {
      id: 'note-1',
      paperId: papers[0]?.id ?? 'paper-1',
      title: 'Reading note',
      content: { Summary: 'Original note summary.' },
      createdAt: '2026-03-17T00:00:00.000Z',
      updatedAt: '2026-03-17T00:00:00.000Z',
    },
  };

  const listPapers = vi.fn<ResearchClawClient['listPapers']>().mockResolvedValue({
    items: papers,
    total: papers.length,
  });

  const importByIdentifier = vi.fn<ResearchClawClient['importByIdentifier']>().mockResolvedValue({
    paper: importedPaper,
    jobId: 'job-1',
  } satisfies ImportPaperResponse);

  const importPdf = vi.fn<ResearchClawClient['importPdf']>().mockResolvedValue({
    paper: importedPaper,
    jobId: 'job-2',
  } satisfies ImportPaperResponse);

  const detailPapers = [...papers, ...(options.searchResults ?? []), importedPaper].reduce<
    PaperSummary[]
  >((accumulator, paper) => {
    if (accumulator.some((candidate) => candidate.id === paper.id)) {
      return accumulator;
    }

    accumulator.push(paper);
    return accumulator;
  }, []);

  const getPaperDetail = vi.fn<ResearchClawClient['getPaperDetail']>().mockResolvedValue({
    paper: importedPaper,
    pdfUrl: `/papers/${importedPaper.id}/pdf`,
  } satisfies GetPaperDetailResponse);
  getPaperDetail.mockImplementation(async ({ paperId }) => {
    const paper = detailPapers.find((candidate) => candidate.id === paperId) ?? importedPaper;
    return {
      paper,
      pdfUrl: `/papers/${paper.id}/pdf`,
    } satisfies GetPaperDetailResponse;
  });

  const getReadingDetail = vi
    .fn<ResearchClawClient['getReadingDetail']>()
    .mockImplementation(async () => readingDetail);

  const saveReadingNote = vi
    .fn<ResearchClawClient['saveReadingNote']>()
    .mockImplementation(async (request: SaveReadingNoteRequest) => {
      const response = {
        note: {
          id: request.noteId ?? 'note-1',
          paperId: request.paperId,
          title: request.title ?? 'Reading note',
          content: request.content,
          createdAt: readingDetail.note?.createdAt ?? '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T01:00:00.000Z',
        },
      } satisfies SaveReadingNoteResponse;

      readingDetail = {
        ...readingDetail,
        note: response.note,
      };

      return response;
    });

  const searchResults = options.searchResults ?? [
    createPaperSummary({ id: 'paper-3', title: 'Search Result Paper' }),
  ];
  const search = vi.fn<ResearchClawClient['search']>().mockResolvedValue({
    mode: 'text',
    results: searchResults,
    total: searchResults.length,
  } satisfies SearchResponse);

  const listJobStatus = vi
    .fn<ResearchClawClient['listJobStatus']>()
    .mockResolvedValue([] satisfies JobStatus[]);

  const subscribeJobEvents = vi
    .fn<ResearchClawClient['subscribeJobEvents']>()
    .mockImplementation(
      async (_jobId: string, _onEvent: (event: JobStreamEvent) => void) => () => undefined,
    );

  const client: ResearchClawClient = {
    listPapers,
    importPdf,
    importByIdentifier,
    getPaperDetail,
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
      importPdf,
      importByIdentifier,
      getPaperDetail,
      getReadingDetail,
      saveReadingNote,
      search,
      listJobStatus,
      subscribeJobEvents,
    },
  };
}
