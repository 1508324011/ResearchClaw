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

export interface ResearchClawClient {
  listPapers(request?: ListPapersRequest): Promise<ListPapersResponse>;
  importPdf(file: File): Promise<ImportPaperResponse>;
  importByIdentifier(request: ImportByIdentifierRequest): Promise<ImportPaperResponse>;
  getPaperDetail(request: GetPaperDetailRequest): Promise<GetPaperDetailResponse>;
  getReadingDetail(request: GetReadingDetailRequest): Promise<GetReadingDetailResponse>;
  saveReadingNote(request: SaveReadingNoteRequest): Promise<SaveReadingNoteResponse>;
  search(request: SearchRequest): Promise<SearchResponse>;
  listJobStatus(): Promise<JobStatus[]>;
  subscribeJobEvents(jobId: string, onEvent: (event: JobStreamEvent) => void): Promise<() => void>;
}
