import http from 'http';
import {
  GetReadingDetailRequestSchema,
  GetReadingDetailResponseSchema,
  SaveReadingNoteRequestSchema,
  SaveReadingNoteResponseSchema,
  type PaperSummary,
  type ReadingNote,
} from '@shared';
import { ZodError } from 'zod';
import { PapersService } from '../../main/services/papers.service';
import { ReadingService } from '../../main/services/reading.service';

const MAX_READING_BODY_BYTES = 512 * 1024;

type RoutePaper = NonNullable<Awaited<ReturnType<PapersService['getById']>>>;
type RouteReadingNote = NonNullable<Awaited<ReturnType<ReadingService['getById']>>>;

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > MAX_READING_BODY_BYTES) {
      throw new Error('Request body exceeds the 512 KB limit.');
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function getPathname(req: http.IncomingMessage): string {
  return (req.url ?? '/').split('?')[0];
}

function getPathPaperId(pathname: string): string | null {
  const match = pathname.match(/^\/reading\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getScopedNotesPaperId(pathname: string): string | null {
  const match = pathname.match(/^\/reading\/([^/]+)\/notes$/);
  return match ? decodeURIComponent(match[1]) : null;
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

function mapReadingNote(note: RouteReadingNote): ReadingNote {
  if (!note.paperId) {
    throw new Error('Reading note is missing a paper association.');
  }

  return {
    id: note.id,
    paperId: note.paperId,
    title: note.title,
    content: note.content,
    createdAt: toIsoString(note.createdAt),
    updatedAt: toIsoString(note.updatedAt),
  };
}

function getPaperAssetUrl(paper: RoutePaper): string | undefined {
  return paper.pdfPath ? `/papers/${paper.id}/pdf` : undefined;
}

function getLatestPaperNote(
  notes: Awaited<ReturnType<ReadingService['listByPaper']>>,
): RouteReadingNote | null {
  return notes.find((note) => note.paperId && !note.title.startsWith('Chat:')) ?? null;
}

export function isReadingRoute(req: http.IncomingMessage): boolean {
  const pathname = getPathname(req);

  if (req.method === 'GET') {
    return pathname === '/reading' || /^\/reading\/[^/]+$/.test(pathname);
  }

  if (req.method === 'POST') {
    return pathname === '/reading/note' || /^\/reading\/[^/]+\/notes$/.test(pathname);
  }

  return false;
}

export async function handleReadingRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  papersService: PapersService = new PapersService(),
  readingService: ReadingService = new ReadingService(),
): Promise<void> {
  const pathname = getPathname(req);

  try {
    if (req.method === 'GET') {
      const paperId = getPathPaperId(pathname);
      if (!paperId) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }

      const request = GetReadingDetailRequestSchema.parse({ paperId });
      const paper = await papersService.getById(request.paperId);
      if (!paper) {
        sendJson(res, 404, { error: 'Paper not found' });
        return;
      }

      const notes = await readingService.listByPaper(request.paperId);
      const latestNote = getLatestPaperNote(notes);
      const response = GetReadingDetailResponseSchema.parse({
        paper: mapPaperSummary(paper),
        note: latestNote ? mapReadingNote(latestNote) : null,
        pdfUrl: getPaperAssetUrl(paper),
      });

      sendJson(res, 200, response);
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const rawPayload = body.length > 0 ? JSON.parse(body.toString('utf-8')) : {};
      const scopedPaperId = getScopedNotesPaperId(pathname);

      if (
        scopedPaperId &&
        typeof rawPayload === 'object' &&
        rawPayload !== null &&
        'paperId' in rawPayload &&
        rawPayload.paperId !== scopedPaperId
      ) {
        sendJson(res, 400, { error: 'Route paperId does not match request body.' });
        return;
      }

      const request = SaveReadingNoteRequestSchema.parse(
        scopedPaperId && typeof rawPayload === 'object' && rawPayload !== null
          ? { ...rawPayload, paperId: scopedPaperId }
          : rawPayload,
      );

      const paper = await papersService.getById(request.paperId);
      if (!paper) {
        sendJson(res, 404, { error: 'Paper not found' });
        return;
      }

      if (request.noteId) {
        const existingNote = await readingService.getById(request.noteId);
        if (!existingNote) {
          sendJson(res, 404, { error: 'Reading note not found' });
          return;
        }

        if (existingNote.paperId && existingNote.paperId !== request.paperId) {
          sendJson(res, 400, { error: 'Reading note does not belong to the requested paper.' });
          return;
        }

        const updated = await readingService.update(request.noteId, request.content);
        const response = SaveReadingNoteResponseSchema.parse({ note: mapReadingNote(updated) });
        sendJson(res, 200, response);
        return;
      }

      const created = await readingService.create({
        paperId: request.paperId,
        type: 'paper',
        title: request.title ?? `Reading: ${paper.title}`,
        content: request.content,
      });
      const response = SaveReadingNoteResponseSchema.parse({ note: mapReadingNote(created) });
      sendJson(res, 200, response);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      sendJson(res, 400, { error: 'Invalid reading request.' });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
