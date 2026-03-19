/**
 * IPC client for the renderer process.
 * Replaces apps/web/src/components/api-client.ts
 */

import type {
  AgentConfigItem,
  DetectedAgentItem,
  AddAgentInput,
  AgentTodoItem,
  AgentTodoDetail,
  CreateAgentTodoInput,
  AgentTodoQuery,
  AgentTodoRunItem,
  AgentTodoMessageItem,
  AgentToolKind,
  GraphData,
  UserProfileState,
  UserProfile,
  TaskResultItem,
  ExperimentReportItem,
  GetReadingDetailResponse,
  ImportByIdentifierRequest,
  ImportPaperResponse,
  JobStatus,
  ListPapersRequest,
  ListPapersResponse,
  SaveReadingNoteRequest,
  SaveReadingNoteResponse,
  SearchResponse,
} from '@shared';
import type { ElectronBridgeApi } from '../../shared/platform/researchclaw-host';
import { getResearchClawHost } from '../host/electron-host';
import type { ResearchClawClient } from '../lib/researchclaw-client';

export type { TaskResultItem, ExperimentReportItem };

declare global {
  interface Window {
    electronAPI?: ElectronBridgeApi;
  }
}

let configuredResearchClawClient: ResearchClawClient | null = null;

export function setResearchClawClient(client: ResearchClawClient | null) {
  configuredResearchClawClient = client;
}

export function getResearchClawClient() {
  return configuredResearchClawClient;
}

export function clearResearchClawClient() {
  configuredResearchClawClient = null;
}

function getFallbackJobId(channel: string) {
  return channel.startsWith('jobs:stream:') ? channel.slice('jobs:stream:'.length) : null;
}

function toLegacyPaperItem(summary: ListPapersResponse['items'][number]): PaperItem {
  return {
    id: summary.id,
    shortId: summary.shortId ?? '',
    title: summary.title,
    authors: summary.authors,
    year: summary.year,
    abstract: summary.abstract,
    tagNames: summary.tagNames,
    sourceUrl: summary.sourceUrl,
    createdAt: summary.createdAt,
  };
}

function toLegacySearchResponse(searchResponse: SearchResponse): {
  results: SearchResultItem[];
  total: number;
} {
  return {
    results: searchResponse.results.map((item) => ({
      paperId: item.id,
      title: item.title,
      authors: item.authors.map((name) => ({ name })),
      year: item.year ?? null,
      abstract: item.abstract ?? null,
      citationCount: 0,
      externalIds: item.shortId ? { ArXiv: item.shortId } : {},
      url: item.sourceUrl ?? null,
    })),
    total: searchResponse.total,
  };
}

function toLegacySemanticSearchResult(searchResponse: SearchResponse): SemanticSearchResult {
  return {
    mode: searchResponse.mode === 'semantic' ? 'semantic' : 'fallback',
    fallbackReason:
      searchResponse.mode === 'semantic' ? undefined : 'Showing keyword search results instead.',
    papers: searchResponse.results.map((item) => ({
      id: item.id,
      shortId: item.shortId ?? '',
      title: item.title,
      authors: item.authors,
      year: item.year,
      abstract: item.abstract ?? null,
      similarityScore: item.score ?? 0,
      matchedChunks: item.excerpt ? [item.excerpt] : [],
      sourceUrl: item.sourceUrl,
      tagNames: item.tagNames,
      createdAt: item.createdAt,
    })),
  };
}

function toLegacyReadingNote(note: GetReadingDetailResponse['note']): ReadingNote | null {
  if (!note) {
    return null;
  }

  return {
    id: note.id,
    title: note.title,
    contentJson: JSON.stringify(note.content),
    content: note.content,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

async function invokeThroughFallback<T>(channel: string, ...args: unknown[]): Promise<T> {
  const client = configuredResearchClawClient;

  if (!client) {
    throw new Error(`IPC unavailable for channel "${channel}": Electron preload API not found.`);
  }

  switch (channel) {
    case 'papers:list': {
      const response = await client.listPapers((args[0] as ListPapersRequest | undefined) ?? {});
      return response.items.map(toLegacyPaperItem) as T;
    }
    case 'papers:getByShortId': {
      const shortId = args[0] as string;
      const response = await client.listPapers({});
      const summary = response.items.find(
        (candidate) => candidate.shortId === shortId || candidate.id === shortId,
      );

      if (!summary) {
        throw new Error(`Paper not found for route id "${shortId}".`);
      }

      const detail = await client.getPaperDetail({ paperId: summary.id });
      return {
        ...toLegacyPaperItem(detail.paper),
        pdfUrl: detail.pdfUrl ?? undefined,
      } as T;
    }
    case 'papers:importByIdentifier':
      return client.importByIdentifier(args[0] as ImportByIdentifierRequest) as Promise<T>;
    case 'reading:getDetail':
      return client.getReadingDetail({ paperId: args[0] as string }) as Promise<T>;
    case 'reading:listByPaper': {
      const detail = await client.getReadingDetail({ paperId: args[0] as string });
      const note = toLegacyReadingNote(detail.note);
      return (note ? [note] : []) as T;
    }
    case 'reading:create': {
      const input = args[0] as {
        paperId: string;
        title?: string;
        content?: Record<string, unknown>;
      };
      const response = await client.saveReadingNote({
        paperId: input.paperId,
        title: input.title,
        content: input.content ?? {},
      });
      return {
        ...response.note,
        contentJson: JSON.stringify(response.note.content),
      } as T;
    }
    case 'reading:update': {
      const noteId = args[0] as string;
      const content = (args[1] as Record<string, unknown>) ?? {};
      const papers = await client.listPapers({});
      let paperId: string | null = null;

      for (const paper of papers.items) {
        const detail = await client.getReadingDetail({ paperId: paper.id });
        if (detail.note?.id === noteId) {
          paperId = paper.id;
          break;
        }
      }

      if (!paperId) {
        throw new Error(`Reading note not found for note id "${noteId}".`);
      }

      const response = await client.saveReadingNote({
        noteId,
        paperId,
        content,
      });
      return {
        ...response.note,
        contentJson: JSON.stringify(response.note.content),
      } as T;
    }
    case 'reading:saveNote':
      return client.saveReadingNote(args[0] as SaveReadingNoteRequest) as Promise<T>;
    case 'papers:search': {
      return client.searchExternal({
        query: args[0] as string,
        limit: args[1] as number | undefined,
      });
    }
    case 'papers:semanticSearch': {
      const response = await client.search({
        query: args[0] as string,
        limit: args[1] as number | undefined,
        mode: 'semantic',
      });
      return toLegacySemanticSearchResult(response) as T;
    }
    case 'settings:get':
      return {
        papersDir: '',
        editorCommand: 'code',
      } as T;
    case 'settings:getStorageRoot':
      return '' as T;
    case 'jobs:listStatus':
      return client.listJobStatus() as Promise<T>;
    default:
      throw new Error(
        `IPC unavailable for channel "${channel}": fallback client does not support it.`,
      );
  }
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const host = getResearchClawHost();
  if (host.kind !== 'electron') {
    if (configuredResearchClawClient) {
      return invokeThroughFallback<T>(channel, ...args);
    }

    return Promise.reject(
      new Error(`IPC unavailable for channel "${channel}": Electron preload API not found.`),
    );
  }

  const result = await host.invoke<unknown>(channel, ...args);
  // Check if result is an IpcResult wrapper (has 'success' AND either 'data' or 'error' as top-level keys)
  // This distinguishes IpcResult { success, data?, error? } from direct result objects like { success, output, ... }
  if (
    result !== null &&
    typeof result === 'object' &&
    'success' in (result as object) &&
    ('data' in (result as object) || 'error' in (result as object))
  ) {
    const ipcResult = result as { success: boolean; data?: T; error?: string };
    if (!ipcResult.success) throw new Error(ipcResult.error ?? 'IPC error');
    return ipcResult.data as T;
  }

  return result as T;
}

export type ImportPhase =
  | 'idle'
  | 'scanning'
  | 'parsing_history'
  | 'upserting_papers'
  | 'downloading_pdfs'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface ImportStatus {
  active: boolean;
  total: number;
  completed: number;
  success: number;
  failed: number;
  skipped: number;
  pdfFailed: number;
  phase: ImportPhase;
  message: string;
  lastImportAt: string | null;
  lastImportCount: number;
}

export interface ScanResult {
  papers: Array<{ arxivId: string; title: string; url: string }>;
  newCount: number;
  existingCount: number;
}

export interface SearchResultItem {
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

export interface PaperItem {
  id: string;
  shortId: string;
  title: string;
  authors?: string[];
  submittedAt?: string;
  abstract?: string;
  tagNames?: string[];
  categorizedTags?: Array<{ name: string; category: string }>;
  pdfUrl?: string;
  pdfPath?: string;
  sourceUrl?: string;
  processingStatus?: string;
  processingError?: string | null;
  processedAt?: string | null;
  indexedAt?: string | null;
  metadataSource?: string | null;
  rating?: number | null;
  year?: number | null;
  createdAt?: string;
  lastReadAt?: string | null;
}

export interface PaperProcessingInfo {
  paperId: string;
  processingStatus: string;
  processingError?: string | null;
  processedAt?: string | null;
  indexedAt?: string | null;
  metadataSource?: string | null;
}

export interface TaggingStatus {
  active: boolean;
  total: number;
  completed: number;
  failed: number;
  currentPaperId: string | null;
  currentPaperTitle?: string | null;
  stage?:
    | 'idle'
    | 'building_prompt'
    | 'requesting_model'
    | 'streaming'
    | 'parsing'
    | 'saving'
    | 'done'
    | 'error';
  partialText?: string;
  message: string;
}

export interface TagInfo {
  name: string;
  category: string;
  count: number;
}

export interface ConsolidationSuggestion {
  merges: Array<{ keep: string; remove: string[]; reason: string }>;
  recategorize: Array<{ tag: string; from: string; to: string; reason: string }>;
}

export interface AgenticSearchStep {
  type: 'thinking' | 'searching' | 'found' | 'tool-result' | 'reasoning' | 'done';
  message: string;
  keywords?: string[];
  foundCount?: number;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  paperTitles?: string[];
}

export interface SourceEvent {
  id: string;
  paperId: string;
  source: 'chrome' | 'manual' | 'arxiv';
  rawTitle?: string | null;
  rawUrl?: string | null;
  importedAt: string;
}

export interface AgenticSearchPaper {
  id: string;
  shortId: string;
  title: string;
  authors?: string[];
  submittedAt?: string;
  tagNames?: string[];
  abstract?: string;
  relevanceReason?: string;
  processingStatus?: string;
}

export interface AgenticSearchResult {
  steps: AgenticSearchStep[];
  papers: AgenticSearchPaper[];
}

export interface SemanticSearchSnippet {
  type: 'title' | 'tag' | 'abstract' | 'sentence' | 'chunk';
  text: string;
  score: number;
}

export interface SemanticSearchPaper {
  id: string;
  shortId: string;
  title: string;
  authors?: string[];
  submittedAt?: string | null;
  tagNames?: string[];
  abstract?: string | null;
  relevanceReason?: string;
  similarityScore: number;
  matchedChunks: string[];
  processingStatus?: string;
  processingError?: string | null;
  matchSignals?: Array<'title' | 'tag' | 'abstract' | 'sentence' | 'chunk'>;
  matchedSnippets?: SemanticSearchSnippet[];
}

export interface SemanticSearchResult {
  mode: 'semantic' | 'fallback';
  papers: SemanticSearchPaper[];
  fallbackReason?: string;
}

export interface ReadingNote {
  id: string;
  title: string;
  contentJson: string;
  content: Record<string, unknown>;
  chatNoteId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaperAnalysis {
  summary: string;
  problem: string;
  method: string;
  contributions: string[];
  evidence: string;
  limitations: string[];
  applications: string[];
  questions: string[];
  tags: string[];
}

export type AnalysisStage =
  | 'preparing'
  | 'requesting_model'
  | 'streaming'
  | 'saving'
  | 'done'
  | 'error'
  | 'cancelled';

export interface AnalysisJobStatus {
  jobId: string;
  paperId: string;
  paperShortId?: string | null;
  paperTitle?: string | null;
  active: boolean;
  stage: AnalysisStage;
  partialText: string;
  message: string;
  error?: string | null;
  noteId?: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export type ChatJobStage = 'preparing' | 'streaming' | 'done' | 'error' | 'cancelled';

export interface ChatJobStatus {
  jobId: string;
  paperId: string;
  paperTitle?: string | null;
  chatNoteId?: string | null;
  active: boolean;
  stage: ChatJobStage;
  partialText: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; ts: number }>;
  message: string;
  error?: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ProjectRepo {
  id: string;
  projectId: string;
  repoUrl: string;
  localPath?: string | null;
  clonedAt?: string | null;
  isWorkdirRepo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkdirRepoStatus {
  hasGit: boolean;
  remoteUrl?: string;
  localPath: string;
}

export interface ProjectIdea {
  id: string;
  projectId: string;
  title: string;
  content: string;
  paperIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  workdir?: string | null;
  sshServerId?: string | null;
  remoteWorkdir?: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string | null;
  repos: ProjectRepo[];
  ideas: ProjectIdea[];
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface CloneResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  model: string;
  baseURL?: string;
  enabled: boolean;
  hasApiKey?: boolean;
}

export interface CliTool {
  name: string;
  displayName: string;
  command: string;
  isInstalled: boolean;
  version?: string;
}

export type ProviderKind = 'anthropic' | 'openai' | 'gemini' | 'custom';

export type ModelKind = 'agent' | 'lightweight';
export type ModelBackend = 'api' | 'cli';
export type { AgentToolKind };

export interface ProxyScope {
  pdfDownload: boolean;
  aiApi: boolean;
  cliTools: boolean;
}

export interface SemanticSearchSettings {
  enabled: boolean;
  autoProcess: boolean;
  autoEnrich: boolean;
  embeddingModel: string;
  embeddingProvider: 'builtin' | 'openai-compatible';
  embeddingApiBase?: string;
  embeddingApiKey?: string;
  recommendationExploration: number;
}

export interface EmbeddingConfig {
  id: string;
  name: string;
  provider: 'builtin' | 'openai-compatible';
  embeddingModel: string;
  embeddingApiBase?: string;
  embeddingApiKey?: string;
}

export interface SemanticEmbeddingTestResult {
  success: boolean;
  model: string;
  baseUrl: string;
  dimensions: number;
  elapsedMs: number;
  preview: number[];
}

export interface SemanticDebugProbeResult {
  ok: boolean;
  status?: number;
  error?: string;
  bodyPreview?: string;
}

export interface SemanticIndexDebugSummary {
  totalPapers: number;
  indexedPapers: number;
  pendingPapers: number;
  failedPapers: number;
  totalChunks: number;
  recentFailures: Array<{
    id: string;
    shortId: string;
    title: string;
    processingStatus: string;
    processingError: string | null;
    updatedAt: string;
  }>;
}

export interface LightweightModelDebugInfo {
  configured: boolean;
  backend?: 'api' | 'cli';
  provider?: string;
  model?: string;
  baseURL?: string;
  hasApiKey?: boolean;
}

export interface SemanticDebugResult {
  success: boolean;
  baseUrl: string;
  embeddingModel: string;
  enabled: boolean;
  autoProcess: boolean;
  autoEnrich: boolean;
  indexSummary: SemanticIndexDebugSummary;
  lightweightModel: LightweightModelDebugInfo;
  notes: string[];
}

export interface SemanticModelPullJob {
  id: string;
  kind: 'embedding';
  model: string;
  baseUrl: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  message: string;
  detail?: string;
  progress?: number;
  completedBytes?: number;
  totalBytes?: number;
  lastUpdatedAt: string;
  recentEvents?: string[];
  startedAt: string;
  finishedAt?: string;
}

export interface ProxyTestResult {
  url: string;
  name: string;
  success: boolean;
  latency?: number;
  error?: string;
}

export interface TokenUsageRecord {
  timestamp: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  kind: 'agent' | 'lightweight' | 'chat' | 'other';
}

export interface TokenUsageSummary {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCalls: number;
  byProvider: Record<string, { prompt: number; completion: number; total: number; calls: number }>;
  byModel: Record<string, { prompt: number; completion: number; total: number; calls: number }>;
  byKind: Record<string, { prompt: number; completion: number; total: number; calls: number }>;
  lastUpdated: string | null;
}

export interface AgentConfigFileStatus {
  label: string;
  path: string;
  exists: boolean;
}

export interface AgentConfigStatus {
  tool: AgentToolKind;
  files: AgentConfigFileStatus[];
  missingRequired: boolean;
}

export interface AgentConfigContents {
  tool: AgentToolKind;
  configContent?: string;
  authContent?: string;
}

export interface CliTestDiagnostics {
  command: string;
  args: string[];
  exitCode?: number | null;
  timedOut?: boolean;
  stdout?: string;
  stderr?: string;
  structuredOutput?: string;
  stdoutFile?: string;
  stderrFile?: string;
  structuredOutputFile?: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  backend: ModelBackend;
  provider?: 'anthropic' | 'openai' | 'gemini' | 'custom';
  model?: string;
  baseURL?: string;
  command?: string;
  envVars?: string;
  agentTool?: AgentToolKind;
  configContent?: string;
  authContent?: string;
  hasApiKey?: boolean;
}

export interface ProjectPaperItem extends PaperItem {
  addedAt: string;
  note?: string | null;
  projectPaperId: string;
}

export type { UserProfileState, UserProfile };

export interface CliConfig {
  id: string;
  name: string;
  command: string;
  envVars: string;
  provider: ProviderKind;
  active: boolean;
  useProxy?: boolean;
}

export interface SshServerItem {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  privateKeyPath?: string | null;
  defaultCwd?: string | null;
}

export interface RemoteDirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  modifyTime: number;
}

export interface RemoteAgentInfo {
  name: string;
  path: string;
  version?: string;
}

export interface SshTestResult {
  success: boolean;
  error?: string;
  serverInfo?: {
    host: string;
    port: number;
    username: string;
    homeDir?: string;
  };
}

export interface SshConfigEntry {
  host: string;
  hostname?: string;
  port?: number;
  user?: string;
  identityFile?: string;
}

export const ipc = {
  // Papers
  listPapers: (query?: ListPapersRequest) => invoke<PaperItem[]>('papers:list', query ?? {}),
  listTodayPapers: () => invoke<PaperItem[]>('papers:listToday'),
  createPaper: (input: Record<string, unknown>) => invoke<PaperItem>('papers:create', input),
  importLocalPdf: (filePath: string) => invoke<PaperItem>('papers:importLocalPdf', filePath),
  importLocalPdfs: (filePaths: string[]) =>
    invoke<{ total: number; success: number; failed: number }>('papers:importLocalPdfs', filePaths),
  downloadPaper: (input: string, tags?: string[]) =>
    invoke<{
      paper: PaperItem;
      download: { success: boolean; size: number; skipped: boolean };
      existed: boolean;
    }>('papers:download', input, tags),
  getPaper: (id: string) => invoke<PaperItem>('papers:getById', id),
  getPaperByShortId: (shortId: string) => invoke<PaperItem>('papers:getByShortId', shortId),
  getPaperProcessingStatus: (paperId: string) =>
    invoke<PaperProcessingInfo | null>('papers:getProcessingStatus', paperId),
  retryPaperProcessing: (paperId: string) =>
    invoke<{ queued: boolean }>('papers:retryProcessing', paperId),
  downloadPdf: (paperId: string, pdfUrl: string) =>
    invoke<{ pdfPath: string; size: number; skipped: boolean }>(
      'papers:downloadPdf',
      paperId,
      pdfUrl,
    ),
  deletePaper: (id: string) => invoke<PaperItem | null>('papers:delete', id),
  deletePapers: (ids: string[]) => invoke<number>('papers:deleteMany', ids),
  touchPaper: (id: string) => invoke<void>('papers:touch', id),
  updatePaperTags: (id: string, tags: string[]) => invoke<PaperItem>('papers:updateTags', id, tags),
  updatePaperRating: (id: string, rating: number | null) =>
    invoke<PaperItem>('papers:updateRating', id, rating),
  listAllTags: () => invoke<TagInfo[]>('papers:listTags'),
  agenticSearch: (query: string) => invoke<AgenticSearchResult>('papers:agenticSearch', query),
  semanticSearch: (query: string, limit?: number) =>
    invoke<SemanticSearchResult>('papers:semanticSearch', query, limit),
  searchPapers: (query: string, limit?: number) =>
    invoke<{ results: SearchResultItem[]; total: number }>('papers:search', query, limit),
  getSourceEvents: (paperId: string) => invoke<SourceEvent[]>('papers:getSourceEvents', paperId),
  exportBibtex: (paperIds: string[]) => invoke<string>('papers:exportBibtex', paperIds),
  extractGithubUrl: (input: { title: string; abstract?: string }) =>
    invoke<string | null>('papers:extractGithubUrl', input),

  importByIdentifier: (request: ImportByIdentifierRequest) =>
    invoke<ImportPaperResponse>('papers:importByIdentifier', request),

  getReadingDetail: (paperId: string) =>
    invoke<GetReadingDetailResponse>('reading:getDetail', paperId),

  saveReadingNote: (request: SaveReadingNoteRequest) =>
    invoke<SaveReadingNoteResponse>('reading:saveNote', request),

  listImportStatus: () => invoke<JobStatus[]>('jobs:listStatus'),

  onJobProgress: (channel: string, listener: (...args: unknown[]) => void) => {
    const host = getResearchClawHost();
    if (host.kind === 'electron') {
      return host.on(channel, listener);
    }

    const client = getResearchClawClient();
    const jobId = getFallbackJobId(channel);

    if (!client || !jobId) {
      return () => undefined;
    }

    let unsubscribe = () => undefined;
    let stopRequested = false;

    void client
      .subscribeJobEvents(jobId, (event) => {
        listener(event);
      })
      .then((cleanup) => {
        if (stopRequested) {
          cleanup();
          return;
        }

        unsubscribe = cleanup;
      });

    return () => {
      stopRequested = true;
      unsubscribe();
    };
  },

  // Tagging
  tagPaper: (paperId: string) =>
    invoke<Array<{ name: string; category: string }>>('tagging:tagPaper', paperId),
  organizePaperTags: (paperId: string) =>
    invoke<Array<{ name: string; category: string }>>('tagging:organizePaper', paperId),
  tagUntagged: () => invoke<{ started: boolean }>('tagging:tagUntagged'),
  cancelTagging: () => invoke<{ cancelled: boolean }>('tagging:cancel'),
  getTaggingStatus: () => invoke<TaggingStatus>('tagging:status'),
  suggestConsolidation: () => invoke<ConsolidationSuggestion>('tagging:suggestConsolidation'),
  mergeTag: (keep: string, remove: string[]) =>
    invoke<{ success: boolean }>('tagging:merge', keep, remove),
  recategorizeTag: (name: string, newCategory: string) =>
    invoke<{ success: boolean }>('tagging:recategorize', name, newCategory),
  renameTag: (oldName: string, newName: string) =>
    invoke<{ success: boolean }>('tagging:rename', oldName, newName),
  deleteTag: (name: string) => invoke<{ success: boolean }>('tagging:deleteTag', name),

  // Reading
  listReading: (paperId: string) => invoke<ReadingNote[]>('reading:listByPaper', paperId),
  listReadingChatSessions: (paperId: string) =>
    invoke<ReadingNote[]>('reading:listChatSessions', paperId),
  createReading: (input: Record<string, unknown>) => invoke<ReadingNote>('reading:create', input),
  updateReading: (id: string, content: Record<string, unknown>) =>
    invoke<ReadingNote>('reading:update', id, content),
  getReading: (id: string) => invoke<ReadingNote>('reading:getById', id),
  deleteReading: (id: string) => invoke<ReadingNote>('reading:delete', id),
  saveChat: (input: { paperId: string; noteId: string | null; messages: unknown[] }) =>
    invoke<{ id: string }>('reading:saveChat', input),
  analyzePaper: (input: { sessionId?: string; paperId: string; pdfUrl?: string }) =>
    invoke<{ jobId: string; sessionId: string; started: boolean; alreadyRunning?: boolean }>(
      'reading:analyze',
      input,
    ),
  listAnalysisJobs: () => invoke<AnalysisJobStatus[]>('reading:analysisJobs'),
  killAnalysis: (jobId: string) => invoke<{ killed: boolean }>('reading:analyzeKill', jobId),
  chat: (input: {
    sessionId: string;
    paperId: string;
    messages: unknown[];
    pdfUrl?: string;
    chatNoteId?: string | null;
  }) => invoke<{ jobId: string; sessionId: string; started: boolean }>('reading:chat', input),
  listChatJobs: () => invoke<ChatJobStatus[]>('reading:chatJobs'),
  killChat: (jobId: string) => invoke<{ killed: boolean }>('reading:chatKill', jobId),
  aiEditNotes: (input: {
    paperId: string;
    instruction: string;
    currentNotes: Record<string, string>;
    pdfUrl?: string;
  }) => invoke<Record<string, string>>('reading:aiEdit', input),
  extractPdfUrl: (paperId: string) => invoke<string | null>('reading:extractPdfUrl', paperId),
  generateNotes: (chatNoteId: string) =>
    invoke<{ id: string; title: string; contentJson: string }>('reading:generateNotes', chatNoteId),
  generateNotesFromAllChats: (paperId: string) =>
    invoke<{ id: string; title: string; contentJson: string }>(
      'reading:generateNotesFromAllChats',
      paperId,
    ),

  // Projects
  listProjects: () => invoke<ProjectItem[]>('projects:list'),
  createProject: (input: {
    name: string;
    description?: string;
    workdir?: string;
    sshServerId?: string;
    remoteWorkdir?: string;
  }) => invoke<ProjectItem>('projects:create', input),
  updateProject: (
    id: string,
    data: {
      name?: string;
      description?: string;
      workdir?: string;
      sshServerId?: string;
      remoteWorkdir?: string;
    },
  ) => invoke<ProjectItem>('projects:update', id, data),
  deleteProject: (id: string) => invoke<ProjectItem>('projects:delete', id),
  touchProject: (id: string) => invoke<void>('projects:touch', id),

  addRepo: (input: { projectId: string; repoUrl: string }) =>
    invoke<ProjectRepo>('projects:repo:add', input),
  cloneRepo: (repoId: string, repoUrl: string) =>
    invoke<CloneResult>('projects:repo:clone', repoId, repoUrl),
  getCommits: (localPath: string, limit?: number) =>
    invoke<CommitInfo[]>('projects:repo:commits', localPath, limit),
  deleteRepo: (id: string) => invoke<ProjectRepo>('projects:repo:delete', id),

  // Workdir repo (no clone needed)
  checkWorkdirGit: (projectId: string) =>
    invoke<WorkdirRepoStatus | null>('projects:workdir:check', projectId),
  initWorkdirGit: (projectId: string) =>
    invoke<{ success: boolean; error?: string }>('projects:workdir:init', projectId),
  addWorkdirRepo: (projectId: string) =>
    invoke<{ id: string; repoUrl: string; localPath: string } | null>(
      'projects:workdir:addRepo',
      projectId,
    ),

  createProjectIdea: (input: {
    projectId: string;
    title: string;
    content: string;
    paperIds?: string[];
  }) => invoke<ProjectIdea>('projects:idea:create', input),
  generateProjectIdea: (input: { projectId: string; paperIds: string[]; repoIds?: string[] }) =>
    invoke<{ id: string; title: string; content: string }>('projects:idea:generate', input),
  updateProjectIdea: (id: string, data: { title?: string; content?: string }) =>
    invoke<ProjectIdea>('projects:idea:update', id, data),
  deleteProjectIdea: (id: string) => invoke<ProjectIdea>('projects:idea:delete', id),

  startIdeaChat: (input: {
    sessionId: string;
    projectId: string;
    paperIds: string[];
    repoIds?: string[];
    messages: { role: 'user' | 'assistant'; content: string }[];
  }) => invoke<{ sessionId: string; started: boolean }>('projects:idea:chat', input),
  killIdeaChat: (sessionId: string) =>
    invoke<{ killed: boolean }>('projects:idea:chatKill', sessionId),
  extractTaskFromChat: (input: {
    projectId: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  }) => invoke<{ title: string; prompt: string }>('projects:idea:extract-task', input),

  // ACP Chat (unified lightweight + agent chat)
  createAcpChatSession: (input: {
    projectId: string;
    title: string;
    paperIds?: string[];
    repoIds?: string[];
    backend?: string | null;
    cwd?: string | null;
    sessionMode?: string | null;
  }) =>
    invoke<{
      id: string;
      projectId: string;
      title: string;
      paperIdsJson: string;
      repoIdsJson: string;
      backend: string | null;
      cwd: string | null;
      sessionMode: string | null;
      createdAt: string;
      updatedAt: string;
    }>('acp-chat:session:create', input),
  listAcpChatSessions: (projectId: string) =>
    invoke<
      {
        id: string;
        projectId: string;
        title: string;
        paperIdsJson: string;
        repoIdsJson: string;
        backend: string | null;
        cwd: string | null;
        sessionMode: string | null;
        createdAt: string;
        updatedAt: string;
      }[]
    >('acp-chat:session:list', projectId),
  getAcpChatSession: (id: string) =>
    invoke<{
      id: string;
      projectId: string;
      title: string;
      paperIds: string[];
      repoIds: string[];
      backend: string | null;
      cwd: string | null;
      sessionMode: string | null;
      createdAt: string;
      updatedAt: string;
    } | null>('acp-chat:session:get', id),
  updateAcpChatSessionTitle: (id: string, title: string) =>
    invoke<{
      id: string;
      projectId: string;
      title: string;
      paperIdsJson: string;
      repoIdsJson: string;
      createdAt: string;
      updatedAt: string;
    }>('acp-chat:session:updateTitle', id, title),
  updateAcpChatSessionBackend: (id: string, backend: string | null) =>
    invoke<{
      id: string;
      projectId: string;
      title: string;
      paperIdsJson: string;
      repoIdsJson: string;
      backend: string | null;
      cwd: string | null;
      createdAt: string;
      updatedAt: string;
    }>('acp-chat:session:updateBackend', id, backend),
  deleteAcpChatSession: (id: string) =>
    invoke<{
      id: string;
      projectId: string;
      title: string;
      paperIdsJson: string;
      repoIdsJson: string;
      createdAt: string;
      updatedAt: string;
    }>('acp-chat:session:delete', id),
  listAcpChatMessages: (sessionId: string) =>
    invoke<
      {
        id: string;
        sessionId: string;
        role: string;
        content: string;
        metadataJson: string;
        createdAt: string;
      }[]
    >('acp-chat:message:list', sessionId),
  sendAcpChatMessage: (input: {
    chatSessionId: string;
    projectId: string;
    paperIds: string[];
    repoIds?: string[];
    prompt: string;
    backend?: string | null;
    cwd?: string;
    language?: 'en' | 'zh';
  }) => invoke<{ jobId: string; started: boolean }>('acp-chat:send', input),
  killAcpChatJob: (jobId: string) => invoke<{ killed: boolean }>('acp-chat:kill', jobId),
  respondToAcpChatPermission: (jobId: string, requestId: number, optionId: string) =>
    invoke<{ responded: boolean }>('acp-chat:permission:respond', jobId, requestId, optionId),
  generateAcpChatTitle: (content: string) => invoke<string>('acp-chat:generateTitle', content),

  // Ingest
  importChromeHistoryFromFile: (filePath: string) =>
    invoke<{ imported: number; previewTitles: string[] }>('ingest:chromeHistoryFromFile', filePath),
  importChromeHistoryAuto: (days: number | null = 1) =>
    invoke<{ imported: number; previewTitles: string[] }>('ingest:chromeHistoryAuto', days),
  scanLocalPapersDir: (dir: string) => invoke<{ started: boolean }>('ingest:scanLocalDir', dir),
  getImportStatus: () => invoke<ImportStatus>('ingest:status'),
  // New scan/import flow
  scanChromeHistory: (days: number | null = 1) => invoke<ScanResult>('ingest:scan', days),
  importScannedPapers: (papers: ScanResult['papers']) =>
    invoke<{ started: boolean }>('ingest:importScanned', papers),
  cancelImport: () => invoke<{ cancelled: boolean }>('ingest:cancel'),

  // Providers
  listProviders: () => invoke<ProviderConfig[]>('providers:list'),
  saveProvider: (config: Record<string, unknown>) =>
    invoke<{ success: boolean }>('providers:save', config),
  getActiveProvider: () => invoke<string>('providers:getActive'),
  setActiveProvider: (id: string) => invoke<{ success: boolean }>('providers:setActive', id),

  // App settings
  getSettings: () =>
    invoke<{ papersDir: string; editorCommand: string; proxy?: string; proxyScope?: ProxyScope }>(
      'settings:get',
    ),
  setStorageDir: (dir: string) => invoke<{ success: boolean }>('settings:setStorageDir', dir),
  setPapersDir: (dir: string) => invoke<{ success: boolean }>('settings:setPapersDir', dir),
  setEditor: (cmd: string) => invoke<{ success: boolean }>('settings:setEditor', cmd),
  setProxy: (proxy: string | undefined) => invoke<{ success: boolean }>('settings:setProxy', proxy),
  getProxyEnabled: () => invoke<{ enabled: boolean }>('settings:getProxyEnabled'),
  setProxyEnabled: (enabled: boolean) =>
    invoke<{ success: boolean }>('settings:setProxyEnabled', enabled),
  setProxyScope: (scope: ProxyScope) =>
    invoke<{ success: boolean }>('settings:setProxyScope', scope),
  testProxy: (proxyUrl?: string) =>
    invoke<{ hasProxy: boolean; results: ProxyTestResult[] }>('settings:testProxy', proxyUrl),
  selectFolder: () => invoke<string | null>('settings:selectFolder'),
  selectPdfFile: () => invoke<string[] | null>('settings:selectPdfFile'),
  saveBibtexFile: (content: string) => invoke<boolean>('settings:saveBibtexFile', content),
  getStorageRoot: () => invoke<string>('settings:getStorageRoot'),
  getSemanticSearchSettings: () => invoke<SemanticSearchSettings>('settings:getSemanticSearch'),
  setSemanticSearchSettings: (settings: Partial<SemanticSearchSettings>) =>
    invoke<{ success: boolean }>('settings:setSemanticSearch', settings),
  testSemanticEmbedding: (settings?: Partial<SemanticSearchSettings>) =>
    invoke<SemanticEmbeddingTestResult>('settings:testSemanticEmbedding', settings),
  getSemanticDebugInfo: (settings?: Partial<SemanticSearchSettings>) =>
    invoke<SemanticDebugResult>('settings:getSemanticDebugInfo', settings),
  startSemanticModelPull: (settings?: Partial<SemanticSearchSettings>) =>
    invoke<SemanticModelPullJob>('settings:startSemanticModelPull', settings),
  listSemanticModelPullJobs: () =>
    invoke<SemanticModelPullJob[]>('settings:listSemanticModelPullJobs'),
  getDevMode: () => invoke<{ enabled: boolean }>('settings:getDevMode'),
  setDevMode: (enabled: boolean) => invoke<{ success: boolean }>('settings:setDevMode', enabled),
  getLanguage: () => invoke<{ language: 'en' | 'zh' }>('settings:getLanguage'),
  setLanguage: (lang: 'en' | 'zh') => invoke<{ success: boolean }>('settings:setLanguage', lang),

  // Embedding configs (multi-card UI)
  listEmbeddingConfigs: () =>
    invoke<{ configs: EmbeddingConfig[]; activeId: string | null }>('embedding:list'),
  saveEmbeddingConfig: (config: EmbeddingConfig) =>
    invoke<{ success: boolean }>('embedding:save', config),
  deleteEmbeddingConfig: (id: string) => invoke<{ success: boolean }>('embedding:delete', id),
  setActiveEmbeddingConfig: (id: string) => invoke<{ success: boolean }>('embedding:setActive', id),

  // Shell
  openInEditor: (dirPath: string) =>
    invoke<{ success: boolean; error?: string }>('shell:openInEditor', dirPath),

  // CLI tools
  detectCliTools: () => invoke<CliTool[]>('cli:detect'),
  getSystemAgentConfig: (tool: AgentToolKind) =>
    invoke<{ tool: AgentToolKind; configContent?: string; authContent?: string }>(
      'cli:getSystemConfig',
      tool,
    ),
  testCli: (command: string, extraArgs?: string, envVars?: string) =>
    invoke<{
      success: boolean;
      output?: string;
      error?: string;
      diagnostics?: CliTestDiagnostics;
      logFile?: string;
    }>('cli:test', command, extraArgs, envVars),
  testAgentCli: (options: {
    command: string;
    extraArgs?: string;
    envVars?: string;
    agentTool?: AgentToolKind;
    configContent?: string;
    authContent?: string;
  }) =>
    invoke<{
      success: boolean;
      output?: string;
      error?: string;
      diagnostics?: CliTestDiagnostics;
      logFile?: string;
    }>('cli:testAgent', options),
  runCli: (options: {
    tool: string;
    args: string[];
    sessionId: string;
    cwd?: string;
    envVars?: string;
    useProxy?: boolean;
    displayLabel?: string;
    homeFiles?: Array<{ relativePath: string; content: string }>;
    modelId?: string;
  }) => invoke<{ sessionId: string; started: boolean }>('cli:run', options),
  killCli: (sessionId: string) => invoke<{ killed: boolean }>('cli:kill', sessionId),

  // CLI tools config (persisted in ~/.vibe-research/)
  listCliConfigs: () => invoke<CliConfig[]>('cliTools:list'),
  saveCliConfigs: (tools: CliConfig[]) => invoke<{ success: boolean }>('cliTools:save', tools),

  // Models (new unified config)
  listModels: () => invoke<ModelConfig[]>('models:list'),
  getActiveModelIds: () => invoke<Record<ModelKind, string | null>>('models:getActiveIds'),
  getActiveModel: (kind: ModelKind) => invoke<ModelConfig | null>('models:getActive', kind),
  saveModel: (config: Omit<ModelConfig, 'hasApiKey'> & { apiKey?: string }) =>
    invoke<{ success: boolean }>('models:save', config),
  deleteModel: (id: string) => invoke<{ success: boolean }>('models:delete', id),
  setActiveModel: (kind: ModelKind, id: string) =>
    invoke<{ success: boolean }>('models:setActive', kind, id),
  testSavedModelConnection: (id: string) =>
    invoke<{
      success: boolean;
      error?: string;
      output?: string;
      diagnostics?: CliTestDiagnostics;
      logFile?: string;
    }>('models:testSavedConnection', id),
  getModelApiKey: (id: string) => invoke<string | null>('models:getApiKey', id),
  getAgentConfigStatus: (tool: AgentToolKind) =>
    invoke<AgentConfigStatus>('models:getAgentConfigStatus', tool),
  getAgentConfigContents: (tool: AgentToolKind) =>
    invoke<AgentConfigContents>('models:getAgentConfigContents', tool),
  testModelConnection: (params: {
    provider: 'anthropic' | 'openai' | 'gemini' | 'custom';
    model: string;
    apiKey?: string;
    baseURL?: string;
  }) => invoke<{ success: boolean; error?: string }>('models:testConnection', params),

  // Project Papers
  listProjectPapers: (projectId: string) =>
    invoke<ProjectPaperItem[]>('projects:papers:list', projectId),
  addPaperToProject: (projectId: string, paperId: string, note?: string) =>
    invoke<unknown>('projects:papers:add', projectId, paperId, note),
  removePaperFromProject: (projectId: string, paperId: string) =>
    invoke<unknown>('projects:papers:remove', projectId, paperId),
  getProjectsForPaper: (paperId: string) =>
    invoke<ProjectItem[]>('projects:papers:get-by-paper', paperId),

  // User profile
  getUserProfile: () => invoke<UserProfileState>('userProfile:get'),
  updateUserProfile: (input: Partial<UserProfile>) =>
    invoke<UserProfileState>('userProfile:update', input),
  generateUserProfileSummary: () => invoke<UserProfileState>('userProfile:generateSummary'),

  // Citations & Graph
  extractCitations: (paper: {
    id: string;
    shortId: string;
    title: string;
    sourceUrl?: string | null;
  }) =>
    invoke<{ referencesFound: number; citationsFound: number; matched: number }>(
      'citations:extract',
      paper,
    ),
  getCitationsForPaper: (paperId: string) =>
    invoke<{ references: unknown[]; citedBy: unknown[] }>('citations:getForPaper', paperId),
  getGraphData: (options?: { includeGhostNodes?: boolean }) =>
    invoke<GraphData>('citations:getGraphData', options),
  getGraphForPaper: (paperId: string, depth?: number, includeGhostNodes?: boolean) =>
    invoke<GraphData>('citations:getGraphForPaper', paperId, depth, includeGhostNodes),
  findCitationPath: (fromId: string, toId: string) =>
    invoke<string[] | null>('citations:findPath', fromId, toId),
  resolveUnmatched: () => invoke<{ resolved: number }>('citations:resolveUnmatched'),
  getCitationCounts: (paperId: string) =>
    invoke<{ references: number; citedBy: number }>('citations:getCounts', paperId),
  exportGraph: (graphData: unknown) =>
    invoke<{ saved: boolean; filePath?: string }>('citations:exportGraph', graphData),

  // Token Usage
  getTokenUsageSummary: () =>
    invoke<{
      totalPromptTokens: number;
      totalCompletionTokens: number;
      totalTokens: number;
      totalCalls: number;
      byProvider: Record<
        string,
        { prompt: number; completion: number; total: number; calls: number }
      >;
      byModel: Record<string, { prompt: number; completion: number; total: number; calls: number }>;
      byKind: Record<string, { prompt: number; completion: number; total: number; calls: number }>;
      lastUpdated: string | null;
    }>('tokenUsage:getSummary'),
  getTokenUsageRecords: () =>
    invoke<
      Array<{
        timestamp: string;
        provider: string;
        model: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        kind: 'agent' | 'lightweight' | 'chat' | 'other';
      }>
    >('tokenUsage:getRecords'),
  clearTokenUsage: () => invoke<{ success: boolean }>('tokenUsage:clear'),

  // Agent Tasks
  detectAgents: () => invoke<DetectedAgentItem[]>('agent-todo:detect-agents'),
  listAgents: () => invoke<AgentConfigItem[]>('agent-todo:list-agents'),
  addAgent: (input: AddAgentInput) => invoke<AgentConfigItem>('agent-todo:add-agent', input),
  updateAgent: (id: string, input: Partial<AddAgentInput>) =>
    invoke<AgentConfigItem>('agent-todo:update-agent', id, input),
  removeAgent: (id: string) => invoke<void>('agent-todo:remove-agent', id),
  listAgentTodos: (query?: AgentTodoQuery) => invoke<AgentTodoItem[]>('agent-todo:list', query),
  getAgentTodo: (id: string) => invoke<AgentTodoDetail>('agent-todo:get', id),
  createAgentTodo: (input: CreateAgentTodoInput) =>
    invoke<AgentTodoItem>('agent-todo:create', input),
  updateAgentTodo: (id: string, input: Partial<CreateAgentTodoInput>) =>
    invoke<AgentTodoItem>('agent-todo:update', id, input),
  deleteAgentTodo: (id: string) => invoke<void>('agent-todo:delete', id),
  runAgentTodo: (todoId: string) => invoke<AgentTodoRunItem>('agent-todo:run', todoId),
  stopAgentTodo: (todoId: string) => invoke<void>('agent-todo:stop', todoId),
  confirmAgentPermission: (todoId: string, requestId: number, optionId: string) =>
    invoke<void>('agent-todo:confirm', todoId, requestId, optionId),
  listAgentTodoRuns: (todoId: string) => invoke<AgentTodoRunItem[]>('agent-todo:list-runs', todoId),
  getAgentTodoRunMessages: (runId: string) =>
    invoke<AgentTodoMessageItem[]>('agent-todo:get-run-messages', runId),
  deleteAgentTodoRun: (runId: string) => invoke<void>('agent-todo:delete-run', runId),
  sendAgentMessage: (todoId: string, runId: string, text: string) =>
    invoke<void>('agent-todo:send-message', todoId, runId, text),
  enableAgentTodoCron: (todoId: string, cronExpr: string) =>
    invoke<void>('agent-todo:enable-cron', todoId, cronExpr),
  disableAgentTodoCron: (todoId: string) => invoke<void>('agent-todo:disable-cron', todoId),
  testAgentAcp: (agentId: string) => invoke<{ sessionId: string }>('agent-todo:test-acp', agentId),
  getAgentRunStats: () =>
    invoke<Array<{ id: string; name: string; callCount: number }>>('agent-todo:get-stats'),
  getActiveAgentTodoStatus: (todoId: string) =>
    invoke<{
      status: string;
      messages: Array<{
        id: string;
        msgId: string;
        type: string;
        role: string;
        content: unknown;
        status?: string | null;
        toolCallId?: string | null;
        toolName?: string | null;
        createdAt: string;
      }>;
      runId: string | null;
    } | null>('agent-todo:get-active-status', todoId),

  // SSH Servers
  listSshServers: () => invoke<SshServerItem[]>('ssh:list-servers'),
  getSshServer: (id: string) => invoke<SshServerItem | null>('ssh:get-server', id),
  addSshServer: (input: {
    label: string;
    host: string;
    port?: number;
    username: string;
    authMethod: 'password' | 'privateKey';
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    defaultCwd?: string;
  }) => invoke<SshServerItem>('ssh:add-server', input),
  updateSshServer: (input: {
    id: string;
    label: string;
    host: string;
    port?: number;
    username: string;
    authMethod: 'password' | 'privateKey';
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
    defaultCwd?: string;
  }) => invoke<SshServerItem>('ssh:update-server', input),
  removeSshServer: (id: string) => invoke<void>('ssh:remove-server', id),
  testSshConnection: (config: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
  }) => invoke<SshTestResult>('ssh:test-connection', config),
  sshListDirectory: (
    config: {
      host: string;
      port: number;
      username: string;
      password?: string;
      privateKeyPath?: string;
      passphrase?: string;
    },
    path: string,
  ) =>
    invoke<{ success: boolean; entries?: RemoteDirEntry[]; error?: string }>(
      'ssh:list-directory',
      config,
      path,
    ),
  detectRemoteAgents: (config: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKeyPath?: string;
    passphrase?: string;
  }) =>
    invoke<{ success: boolean; agents?: RemoteAgentInfo[]; error?: string }>(
      'ssh:detect-remote-agents',
      config,
    ),
  selectSshKeyFile: () =>
    invoke<{ canceled: boolean; path?: string | null }>('ssh:select-key-file'),
  scanSshConfig: () => invoke<SshConfigEntry[]>('ssh:scan-config'),
  parseConfigFile: () => invoke<SshConfigEntry[]>('ssh:parse-config-file'),

  // Reports
  listReports: (projectId: string) => invoke<ExperimentReportItem[]>('reports:list', projectId),
  deleteReport: (reportId: string) => invoke<void>('reports:delete', reportId),
  generateReport: (params: {
    projectId: string;
    title: string;
    todoIds: string[];
    resultIds?: string[];
  }) => invoke<void>('reports:generate', params),
  listTaskResults: (params: { projectId: string }) =>
    invoke<TaskResultItem[]>('reports:listTaskResults', params.projectId),

  // Window controls (for Windows title bar)
  windowClose: () => getResearchClawHost().windowClose(),
  windowMinimize: () => getResearchClawHost().windowMinimize(),
  windowMaximize: () => getResearchClawHost().windowMaximize(),
  windowIsMaximized: () => getResearchClawHost().windowIsMaximized(),
};

/** Subscribe to IPC events from main process */
export function onIpc(channel: string, listener: (...args: unknown[]) => void): () => void {
  return getResearchClawHost().on(channel, listener);
}
