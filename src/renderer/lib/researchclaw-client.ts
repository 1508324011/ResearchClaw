import type {
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
  importByIdentifier(request: ImportByIdentifierRequest): Promise<ImportPaperResponse>;
  getReadingDetail(request: GetReadingDetailRequest): Promise<GetReadingDetailResponse>;
  saveReadingNote(request: SaveReadingNoteRequest): Promise<SaveReadingNoteResponse>;
  search(request: SearchRequest): Promise<SearchResponse>;
  listJobStatus(): Promise<JobStatus[]>;
  subscribeJobEvents(jobId: string, onEvent: (event: JobStreamEvent) => void): Promise<() => void>;
}
