import type {
  GetPaperDetailRequest,
  GetPaperDetailResponse,
  GetReadingDetailRequest,
  GetReadingDetailResponse,
  ImportByIdentifierRequest,
  ImportPaperResponse,
  JobStatus,
  JobStreamEvent,
  ListPapersRequest,
  ListPapersResponse,
  PaperSummary,
  SaveReadingNoteRequest,
  SaveReadingNoteResponse,
  SearchRequest,
  SearchResponse,
} from '@shared';

import type { ResearchClawClient } from './researchclaw-client';

type ElectronInvokeResult<T> = { success: boolean; data?: T; error?: string };

interface ElectronSearchResultItem {
  paperId: string;
  title: string;
  authors: Array<{ name: string }>;
  year: number | null;
  abstract: string | null;
  citationCount: number;
  externalIds: {
    ArXiv?: string;
    DOI?: string;
  };
  url: string | null;
}

interface ElectronPaperListItem {
  id: string;
  shortId: string;
  title: string;
  authors?: string[];
  year?: number | null;
  abstract?: string;
  tagNames?: string[];
  sourceUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  pdfPath?: string | null;
  pdfUrl?: string | null;
}

type FileWithPath = File & { path?: string };

function getElectronAPI() {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('Electron preload API not found.');
  }

  return window.electronAPI;
}

async function invokeElectron<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await getElectronAPI().invoke(channel, ...args);

  if (
    result !== null &&
    typeof result === 'object' &&
    'success' in (result as object) &&
    ('data' in (result as object) || 'error' in (result as object))
  ) {
    const ipcResult = result as ElectronInvokeResult<T>;
    if (!ipcResult.success) {
      throw new Error(ipcResult.error ?? 'IPC error');
    }

    return ipcResult.data as T;
  }

  return result as T;
}

function nowIso() {
  return new Date().toISOString();
}

function toPaperSummary(item: ElectronPaperListItem): PaperSummary {
  const timestamp = item.createdAt ?? nowIso();
  const updatedAt = item.updatedAt ?? timestamp;

  return {
    id: item.id,
    shortId: item.shortId || undefined,
    title: item.title,
    authors: item.authors ?? [],
    year: item.year ?? undefined,
    abstract: item.abstract,
    tagNames: item.tagNames,
    sourceUrl: item.sourceUrl,
    createdAt: timestamp,
    updatedAt,
  };
}

function getLocalFilePath(file: File): string {
  const path = (file as FileWithPath).path;

  if (!path) {
    throw new Error('Electron transport requires a local file path for PDF imports.');
  }

  return path;
}

export class ElectronClient implements ResearchClawClient {
  async listPapers(request: ListPapersRequest = {}): Promise<ListPapersResponse> {
    const items = await invokeElectron<ElectronPaperListItem[]>('papers:list', request);

    return {
      items: items.map(toPaperSummary),
      total: items.length,
    };
  }

  async importPdf(file: File): Promise<ImportPaperResponse> {
    const item = await invokeElectron<ElectronPaperListItem>(
      'papers:importLocalPdf',
      getLocalFilePath(file),
    );

    return { paper: toPaperSummary(item) };
  }

  async importByIdentifier(request: ImportByIdentifierRequest): Promise<ImportPaperResponse> {
    return invokeElectron<ImportPaperResponse>('papers:importByIdentifier', request);
  }

  async getPaperDetail(request: GetPaperDetailRequest): Promise<GetPaperDetailResponse> {
    const item = await invokeElectron<ElectronPaperListItem>('papers:getById', request.paperId);

    return {
      paper: toPaperSummary(item),
      pdfUrl: item.pdfUrl ?? item.pdfPath ?? null,
    };
  }

  async getReadingDetail(request: GetReadingDetailRequest): Promise<GetReadingDetailResponse> {
    return invokeElectron<GetReadingDetailResponse>('reading:getDetail', request.paperId);
  }

  async saveReadingNote(request: SaveReadingNoteRequest): Promise<SaveReadingNoteResponse> {
    return invokeElectron<SaveReadingNoteResponse>('reading:saveNote', request);
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    if (request.mode && request.mode !== 'text') {
      throw new Error('Electron transport currently supports text search only.');
    }

    const result = await invokeElectron<{ results: ElectronSearchResultItem[]; total: number }>(
      'papers:search',
      request.query,
      request.limit,
    );

    return {
      mode: request.mode ?? 'text',
      results: result.results.map((item) => ({
        id: item.paperId,
        shortId: item.externalIds.ArXiv,
        title: item.title,
        authors: item.authors.map((author) => author.name),
        year: item.year ?? undefined,
        abstract: item.abstract ?? undefined,
        sourceUrl: item.url ?? undefined,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })),
      total: result.total,
    };
  }

  async listJobStatus(): Promise<JobStatus[]> {
    return invokeElectron<JobStatus[]>('jobs:listStatus');
  }

  async subscribeJobEvents(
    jobId: string,
    onEvent: (event: JobStreamEvent) => void,
  ): Promise<() => void> {
    const channel = `jobs:stream:${jobId}`;

    return getElectronAPI().on(channel, (_event, payload) => {
      onEvent(payload as JobStreamEvent);
    });
  }
}
