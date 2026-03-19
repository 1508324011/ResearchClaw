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
  SaveReadingNoteRequest,
  SaveReadingNoteResponse,
  SearchRequest,
  SearchResponse,
} from '@shared';

import type { ResearchClawClient } from './researchclaw-client';

const routes = {
  papers: '/papers',
  paperDetail: (paperId: string) => `/papers/${paperId}`,
  importByIdentifier: '/papers/import',
  importPdf: '/import/pdf',
  readingDetail: (paperId: string) => `/reading/${paperId}`,
  readingNotes: (paperId: string) => `/reading/${paperId}/notes`,
  search: '/search',
  jobs: '/jobs',
  jobStream: (jobId: string) => `/jobs/${jobId}/stream`,
};

export class HttpClient implements ResearchClawClient {
  constructor(private readonly baseUrl: string) {}

  async listPapers(request: ListPapersRequest = {}): Promise<ListPapersResponse> {
    const params = new URLSearchParams();

    if (request.q) params.append('q', request.q);
    if (request.year) params.append('year', String(request.year));
    if (request.tag) params.append('tag', request.tag);
    if (request.importedWithin) params.append('importedWithin', request.importedWithin);

    const query = params.toString();
    return this.getJson<ListPapersResponse>(`${routes.papers}${query ? `?${query}` : ''}`);
  }

  async importPdf(file: File): Promise<ImportPaperResponse> {
    const body = new FormData();
    body.append('file', file);

    return this.postFormData<ImportPaperResponse>(routes.importPdf, body);
  }

  async importByIdentifier(request: ImportByIdentifierRequest): Promise<ImportPaperResponse> {
    return this.postJson<ImportPaperResponse>(routes.importByIdentifier, request);
  }

  async getPaperDetail(request: GetPaperDetailRequest): Promise<GetPaperDetailResponse> {
    return this.getJson<GetPaperDetailResponse>(routes.paperDetail(request.paperId));
  }

  async getReadingDetail(request: GetReadingDetailRequest): Promise<GetReadingDetailResponse> {
    return this.getJson<GetReadingDetailResponse>(routes.readingDetail(request.paperId));
  }

  async saveReadingNote(request: SaveReadingNoteRequest): Promise<SaveReadingNoteResponse> {
    return this.postJson<SaveReadingNoteResponse>(routes.readingNotes(request.paperId), request);
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append('q', request.query);
    if (request.limit) params.append('limit', String(request.limit));
    if (request.mode) params.append('mode', request.mode);

    return this.getJson<SearchResponse>(`${routes.search}?${params.toString()}`);
  }

  async listJobStatus(): Promise<JobStatus[]> {
    return this.getJson<JobStatus[]>(routes.jobs);
  }

  async subscribeJobEvents(
    jobId: string,
    onEvent: (event: JobStreamEvent) => void,
  ): Promise<() => void> {
    const controller = new AbortController();

    void this.consumeJobStream(jobId, onEvent, controller.signal);

    return () => {
      controller.abort();
    };
  }

  private async consumeJobStream(
    jobId: string,
    onEvent: (event: JobStreamEvent) => void,
    signal: AbortSignal,
  ) {
    const response = await this.request(routes.jobStream(jobId), {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal,
    });

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer = `${buffer}${decoder.decode(value, { stream: true })}`.replace(/\r\n/g, '\n');
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const line = chunk
            .split('\n')
            .map((entry) => entry.trim())
            .find((entry) => entry.startsWith('data: '));

          if (!line) {
            continue;
          }

          const data = line.slice(6);
          if (!data) {
            continue;
          }

          try {
            onEvent(JSON.parse(data) as JobStreamEvent);
          } catch {
            continue;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.request(path, { method: 'GET' });
    return response.json() as Promise<T>;
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return response.json() as Promise<T>;
  }

  private async postFormData<T>(path: string, body: FormData): Promise<T> {
    const response = await this.request(path, {
      method: 'POST',
      body,
    });

    return response.json() as Promise<T>;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }
}
