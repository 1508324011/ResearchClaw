import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractArxivId } from '@shared';
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

interface DoiMetadata {
  title?: string;
  authors: string[];
  abstract?: string;
  pdfUrl?: string;
  sourceUrl: string;
  submittedAt?: Date;
}

async function fetchPdfBuffer(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible: ResearchClaw Web Import/1.0)',
      Accept: 'application/pdf',
    },
  });

  if (!response.ok) {
    throw new WebImportError(502, `Failed to fetch DOI PDF: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 5 || buffer.toString('ascii', 0, 5) !== '%PDF-') {
    throw new WebImportError(502, 'DOI document did not resolve to a valid PDF.');
  }

  return buffer;
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

function normalizeDoi(value: string): string {
  const trimmed = value.trim().replace(/^doi:\s*/i, '');
  if (!/^10\.\S+\/\S+$/i.test(trimmed)) {
    throw new WebImportError(400, 'Invalid DOI identifier.');
  }

  return trimmed;
}

function normalizeUrl(value: string): string {
  try {
    return new URL(value.trim()).toString();
  } catch {
    throw new WebImportError(400, 'Invalid URL identifier.');
  }
}

function extractMetaTagValues(html: string, name: string): string[] {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta[^>]+name=["']${escapedName}["'][^>]+content=["']([^"']+)["']`,
    'gi',
  );

  return Array.from(html.matchAll(pattern), (match) => match[1].trim()).filter(Boolean);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function stripMarkup(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseIssuedDate(value: unknown): Date | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    !('date-parts' in value) ||
    !Array.isArray(value['date-parts']) ||
    !Array.isArray(value['date-parts'][0])
  ) {
    return undefined;
  }

  const [year, month = 1, day = 1] = value['date-parts'][0];
  if (typeof year !== 'number') {
    return undefined;
  }

  const parsed = new Date(Date.UTC(year, Math.max(month - 1, 0), Math.max(day, 1)));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function fetchDoiMetadata(doi: string): Promise<DoiMetadata> {
  const sourceUrl = `https://doi.org/${doi}`;
  const requestHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible: ResearchClaw Web Import/1.0)',
  };

  const htmlResponse = await fetch(sourceUrl, {
    headers: {
      ...requestHeaders,
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!htmlResponse.ok) {
    throw new WebImportError(502, `Failed to resolve DOI landing page: ${htmlResponse.status}`);
  }

  const html = await htmlResponse.text();
  const htmlTitle = extractMetaTagValues(html, 'citation_title')[0]?.trim();
  const htmlAuthors = extractMetaTagValues(html, 'citation_author');
  const htmlAbstract = extractMetaTagValues(html, 'citation_abstract')[0];
  const htmlPdfUrl = extractMetaTagValues(html, 'citation_pdf_url')[0];
  const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);

  const cslResponse = await fetch(sourceUrl, {
    headers: {
      ...requestHeaders,
      Accept: 'application/vnd.citationstyles.csl+json',
    },
  });

  if (!cslResponse.ok) {
    throw new WebImportError(502, `Failed to fetch DOI metadata: ${cslResponse.status}`);
  }

  const cslPayload = (await cslResponse.json()) as {
    title?: string;
    author?: Array<{ given?: string; family?: string; literal?: string }>;
    abstract?: string;
    issued?: { 'date-parts'?: number[][] };
  };

  const cslAuthors =
    cslPayload.author
      ?.map((author) => {
        if (author.literal?.trim()) {
          return author.literal.trim();
        }

        return [author.given?.trim(), author.family?.trim()].filter(Boolean).join(' ').trim();
      })
      .filter(Boolean) ?? [];

  return {
    sourceUrl,
    title: htmlTitle || cslPayload.title?.trim() || titleTagMatch?.[1]?.trim() || undefined,
    authors: htmlAuthors.length > 0 ? htmlAuthors : cslAuthors,
    abstract: htmlAbstract ? stripMarkup(htmlAbstract) : stripMarkup(cslPayload.abstract ?? ''),
    pdfUrl: htmlPdfUrl,
    submittedAt: parseIssuedDate(cslPayload.issued),
  };
}

function titleFromUrl(value: string): string {
  const url = new URL(value);
  const slug = path.basename(url.pathname).replace(/\.pdf$/i, '');
  return (slug || url.hostname).replace(/[._-]+/g, ' ').trim() || value;
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

  private async finalizeImportResponse(
    paper: Awaited<ReturnType<PapersService['getById']>> extends infer T ? Exclude<T, null> : never,
  ): Promise<ImportPaperResponse> {
    return ImportPaperResponseSchema.parse({
      paper: toPaperSummary(paper),
      jobId: `import:${paper.id}`,
    });
  }

  private async createManualIdentifierImport(input: {
    title: string;
    sourceUrl: string;
    tags: string[];
    pdfUrl?: string;
  }): Promise<ImportPaperResponse> {
    const created = await this.papersService.create({
      title: input.title,
      source: 'manual',
      sourceUrl: input.sourceUrl,
      pdfUrl: input.pdfUrl,
      tags: input.tags,
      authors: [],
    });

    if (input.pdfUrl) {
      await this.papersService.downloadPdf(created.id, input.pdfUrl);
    }

    const storedPaper = await this.papersService.getById(created.id);
    return this.finalizeImportResponse(storedPaper ?? created);
  }

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
    const parsedRequest = ImportByIdentifierRequestSchema.safeParse(input);
    if (!parsedRequest.success) {
      throw new WebImportError(400, 'Invalid import identifier payload.');
    }

    const request = parsedRequest.data;
    if (request.kind === 'doi') {
      const doi = normalizeDoi(request.value);
      const metadata = await fetchDoiMetadata(doi);

      if (!metadata.title || !metadata.abstract || !metadata.pdfUrl) {
        throw new WebImportError(422, 'Unable to import DOI as a complete paper.');
      }

      try {
        const pdfBuffer = await fetchPdfBuffer(metadata.pdfUrl);
        const createdPaper = await this.papersService.createWithLocalPdf({
          title: metadata.title,
          source: 'manual',
          sourceUrl: metadata.sourceUrl,
          tags: ['doi'],
          authors: metadata.authors,
          abstract: metadata.abstract,
          submittedAt: metadata.submittedAt,
          pdfBuffer,
        });

        const storedPaper = await this.papersService.getById(createdPaper.id);
        return this.finalizeImportResponse(storedPaper ?? createdPaper);
      } catch {
        throw new WebImportError(422, 'Unable to import DOI as a complete paper.');
      }
    }

    if (request.kind === 'url') {
      const normalizedUrl = normalizeUrl(request.value);
      const arxivId = extractArxivId(normalizedUrl);
      if (arxivId) {
        request.kind = 'arxiv';
        request.value = arxivId;
      } else {
        const isPdfUrl = normalizedUrl.toLowerCase().endsWith('.pdf');
        return this.createManualIdentifierImport({
          title: titleFromUrl(normalizedUrl),
          sourceUrl: normalizedUrl,
          pdfUrl: isPdfUrl ? normalizedUrl : undefined,
          tags: isPdfUrl ? ['pdf', 'url'] : ['url'],
        });
      }
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
