import http from 'http';
import { ExternalPaperSearchRequestSchema, ExternalPaperSearchResponseSchema } from '@shared';
import { ZodError } from 'zod';
import { searchPapers } from '../../main/services/paper-search.service';
import { WebImportError } from '../services/web-import.service';
import { WEB_IMPORT_BODY_LIMIT_BYTES, getWebImportBodyLimitMessage } from './web-import-body-limit';

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
    if (totalBytes > WEB_IMPORT_BODY_LIMIT_BYTES) {
      throw new WebImportError(413, getWebImportBodyLimitMessage());
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function getPathname(req: http.IncomingMessage): string {
  return (req.url ?? '/').split('?')[0];
}

export function isExternalSearchRoute(req: http.IncomingMessage): boolean {
  return req.method === 'POST' && getPathname(req) === '/papers/search/external';
}

export async function handleExternalSearchRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const body = await readBody(req);
    const payload = body.length > 0 ? JSON.parse(body.toString('utf-8')) : {};
    let request;

    try {
      request = ExternalPaperSearchRequestSchema.parse(payload);
    } catch (error) {
      if (error instanceof ZodError) {
        sendJson(res, 400, { error: 'Invalid external search request.' });
        return;
      }

      throw error;
    }

    const result = await searchPapers(request.query, request.limit);
    const response = ExternalPaperSearchResponseSchema.parse(result);
    sendJson(res, 200, response);
  } catch (error) {
    if (error instanceof WebImportError) {
      sendJson(res, error.statusCode, { error: error.message });
      return;
    }

    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: 'Invalid JSON body.' });
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
