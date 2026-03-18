import { PapersRepository } from '@db';
import { getSemanticSearchSettings } from '../store/app-settings-store';
import { getOptionalBrowserWindows } from '../utils/optional-electron';
import * as paperEmbeddingService from './paper-embedding.service';

export type PaperProcessingStatus =
  | 'idle'
  | 'queued'
  | 'extracting_metadata'
  | 'embedding'
  | 'completed'
  | 'failed';

function broadcastProcessingStatus(payload: {
  paperId: string;
  status: PaperProcessingStatus;
  error?: string | null;
}) {
  for (const win of getOptionalBrowserWindows()) {
    win.webContents.send('papers:processingStatus', payload);
  }
}

async function updateStatus(
  repo: PapersRepository,
  paperId: string,
  status: PaperProcessingStatus,
  extra: {
    processingError?: string | null;
    processedAt?: Date | null;
    indexedAt?: Date | null;
    metadataSource?: string | null;
  } = {},
) {
  await repo.updateProcessingState(paperId, {
    processingStatus: status,
    ...extra,
  });
  broadcastProcessingStatus({ paperId, status, error: extra.processingError });
}

async function processPaper(paperId: string) {
  const repo = new PapersRepository();
  const paper = await repo.findById(paperId);
  if (!paper) return;

  try {
    await updateStatus(repo, paperId, 'embedding', { processingError: null });

    // Generate embeddings for title and abstract
    await paperEmbeddingService.generateEmbeddings(paperId);

    await updateStatus(repo, paperId, 'completed', {
      processingError: null,
      processedAt: new Date(),
      indexedAt: new Date(),
      metadataSource: paper.metadataSource ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateStatus(repo, paperId, 'failed', {
      processingError: message,
      indexedAt: null,
    });
  }
}

export async function resumeAutomaticPaperProcessing() {
  return { queued: 0 };
}

export async function retryPaperProcessing(paperId: string) {
  const settings = getSemanticSearchSettings();
  if (!settings.enabled) return { queued: false };
  await processPaper(paperId);
  return { queued: false };
}

export async function getPaperProcessingStatus(paperId: string) {
  const repo = new PapersRepository();
  const paper = await repo.findById(paperId);
  if (!paper) return null;
  return {
    paperId,
    processingStatus: paper.processingStatus,
    processingError: paper.processingError,
    processedAt: paper.processedAt,
    indexedAt: paper.indexedAt,
    metadataSource: paper.metadataSource,
  };
}

export function schedulePaperProcessing(_paperId: string, _options: { force?: boolean } = {}) {
  // No-op: automatic background processing removed; indexing is now on-demand only.
}
