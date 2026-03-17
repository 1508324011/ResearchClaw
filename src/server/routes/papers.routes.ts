import http from 'http';
import { ListPapersRequestSchema, ListPapersResponseSchema, type PaperSummary } from '@shared';
import { ZodError } from 'zod';
import { PapersService } from '../../main/services/papers.service';
import { WebImportError, WebImportService } from '../services/web-import.service';

const MAX_PAPERS_BODY_BYTES = 2 * 1024 * 1024;

type RoutePaper = NonNullable<Awaited<ReturnType<PapersService['getById']>>>;

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function getPathname(req: http.IncomingMessage): string {
  return (req.url ?? '/').split('?')[0];
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toYear(value: Date | string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.getUTCFullYear();
}

function toOptionalUrl(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function mapPaperSummary(paper: RoutePaper): PaperSummary {
  return {
    id: paper.id,
    shortId: paper.shortId,
    title: paper.title,
    authors: paper.authors,
    year: toYear(paper.submittedAt),
    abstract: paper.abstract ?? undefined,
    tagNames: paper.tagNames,
    sourceUrl: toOptionalUrl(paper.sourceUrl),
    createdAt: toIsoString(paper.createdAt),
    updatedAt: toIsoString(paper.updatedAt),
  };
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_PAPERS_BODY_BYTES) {
      throw new WebImportError(413, 'Request body exceeds the 2 MB upload limit.');
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export function isPapersRoute(req: http.IncomingMessage): boolean {
  const pathname = getPathname(req);
  return (
    (req.method === 'GET' && pathname === '/papers') ||
    (req.method === 'POST' && pathname === '/papers/import')
  );
}

export async function handlePapersRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  papersService: PapersService = new PapersService(),
  importService: WebImportService = new WebImportService(),
): Promise<void> {
  const pathname = getPathname(req);

  try {
    if (req.method === 'GET' && pathname === '/papers') {
      const url = new URL(req.url ?? '/papers', 'http://127.0.0.1');
      const rawYear = url.searchParams.get('year');
      const request = ListPapersRequestSchema.parse({
        q: url.searchParams.get('q') ?? undefined,
        year: rawYear ? Number.parseInt(rawYear, 10) : undefined,
        tag: url.searchParams.get('tag') ?? undefined,
        importedWithin: url.searchParams.get('importedWithin') ?? undefined,
      });

      const papers = await papersService.list(request);
      const response = ListPapersResponseSchema.parse({
        items: papers.map((paper) => mapPaperSummary(paper)),
        total: papers.length,
      });

      sendJson(res, 200, response);
      return;
    }

    if (req.method === 'POST' && pathname === '/papers/import') {
      const body = await readBody(req);
      const payload = body.length > 0 ? JSON.parse(body.toString('utf-8')) : {};
      const result = await importService.importByIdentifier(payload);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof WebImportError) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }

    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: 'Invalid JSON body.' });
      return;
    }

    if (error instanceof ZodError) {
      sendJson(res, 400, { error: 'Invalid papers request.' });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
