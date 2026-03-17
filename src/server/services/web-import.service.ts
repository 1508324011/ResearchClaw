import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PapersService } from '../../main/services/papers.service';
import {
  ImportByIdentifierRequestSchema,
  ImportPaperResponseSchema,
  type ImportPaperResponse,
  type PaperSummary,
} from '@shared';

interface ArxivMetadata {
  title: string;
  authors: string[];
  abstract?: string;
  pdfUrl: string;
  sourceUrl: string;
}

export class WebImportError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'WebImportError';
  }
}

function toPaperSummary(
  paper: Awaited<ReturnType<PapersService['getById']>> extends infer T ? Exclude<T, null> : never,
): PaperSummary {
  return {
    id: paper.id,
    shortId: paper.shortId,
    title: paper.title,
    authors: paper.authors,
    year: paper.submittedAt ? paper.submittedAt.getUTCFullYear() : undefined,
    abstract: paper.abstract ?? undefined,
    tagNames: paper.tagNames,
    sourceUrl: paper.sourceUrl ?? undefined,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
  };
}

function normalizeArxivId(value: string): string {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]+\.[0-9]{4,5}(?:v\d+)?)/i);
  const candidate = (urlMatch?.[1] ?? trimmed).replace(/\.pdf$/i, '');

  if (!/^\d{4}\.\d{4,5}(v\d+)?$/i.test(candidate)) {
    throw new WebImportError(400, 'Invalid arXiv identifier.');
  }

  return candidate.replace(/v\d+$/i, '');
}

async function fetchArxivMetadata(arxivId: string): Promise<ArxivMetadata> {
  const sourceUrl = `https://arxiv.org/abs/${arxivId}`;
  const response = await fetch(sourceUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible: ResearchClaw Web Import/1.0)' },
  });

  if (!response.ok) {
    throw new WebImportError(502, `Failed to fetch arXiv metadata: ${response.status}`);
  }

  const html = await response.text();
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const authorMatches = html.matchAll(/<meta name="citation_author" content="([^"]+)"/g);
  const abstractMatch = html.match(/<meta name="citation_abstract" content="([^"]+)"/i);

  const title = (titleMatch?.[1] ?? '').replace(/^\[[\w./-]+\]\s*/, '').trim();
  if (!title) {
    throw new WebImportError(502, 'arXiv metadata response did not contain a title.');
  }

  const authors = Array.from(authorMatches, (match) => match[1].trim()).filter(Boolean);

  return {
    title,
    authors,
    abstract: abstractMatch?.[1]?.trim() || undefined,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
    sourceUrl,
  };
}

export class WebImportService {
  private readonly papersService = new PapersService();

  async importPdf(buffer: Buffer, filename: string): Promise<ImportPaperResponse> {
    const safeFilename = path.basename(filename || 'uploaded-paper.pdf');
    if (path.extname(safeFilename).toLowerCase() !== '.pdf') {
      throw new WebImportError(400, 'Only PDF uploads are supported.');
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'researchclaw-web-import-'));
    const tempPdfPath = path.join(tempDir, safeFilename);

    try {
      await fs.writeFile(tempPdfPath, buffer);
      const paper = await this.papersService.importLocalPdf(tempPdfPath);
      const storedPaper = await this.papersService.getById(paper.id);
      const summary = toPaperSummary(storedPaper ?? paper);
      return ImportPaperResponseSchema.parse({
        paper: summary,
        jobId: `import:${paper.id}`,
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  async importByIdentifier(input: unknown): Promise<ImportPaperResponse> {
    const request = ImportByIdentifierRequestSchema.parse(input);
    if (request.kind !== 'arxiv') {
      throw new WebImportError(400, 'Task 4 only supports arXiv identifier imports.');
    }

    const arxivId = normalizeArxivId(request.value);
    const metadata = await fetchArxivMetadata(arxivId);
    const paper = await this.papersService.upsertFromIngest({
      title: metadata.title,
      source: 'arxiv',
      sourceUrl: metadata.sourceUrl,
      tags: ['arxiv'],
      authors: metadata.authors,
      abstract: metadata.abstract,
    });

    await this.papersService.downloadPdf(paper.id, metadata.pdfUrl);
    const storedPaper = await this.papersService.getById(paper.id);
    const summary = toPaperSummary(storedPaper ?? paper);

    return ImportPaperResponseSchema.parse({
      paper: summary,
      jobId: `import:${paper.id}`,
    });
  }
}
