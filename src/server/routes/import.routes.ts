import http from 'http';
import { WebImportError, WebImportService } from '../services/web-import.service';
import { getWebImportBodyLimitMessage, WEB_IMPORT_BODY_LIMIT_BYTES } from './web-import-body-limit';

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

function parseMultipartPdf(
  body: Buffer,
  contentType: string | undefined,
): { buffer: Buffer; filename: string } {
  const boundaryMatch = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundaryValue = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundaryValue) {
    throw new WebImportError(400, 'Missing multipart boundary for PDF upload.');
  }

  const boundary = `--${boundaryValue}`;
  const raw = body.toString('latin1');
  const fieldIndex = raw.indexOf('name="file"');
  if (fieldIndex === -1) {
    throw new WebImportError(400, 'Expected multipart field "file".');
  }

  const filenameMatch = raw
    .slice(fieldIndex, raw.indexOf('\r\n\r\n', fieldIndex))
    .match(/filename="([^"]+)"/i);
  const filename = filenameMatch?.[1];
  if (!filename) {
    throw new WebImportError(400, 'Uploaded file is missing a filename.');
  }

  const contentStart = raw.indexOf('\r\n\r\n', fieldIndex);
  if (contentStart === -1) {
    throw new WebImportError(400, 'Malformed multipart upload.');
  }

  const fileStart = contentStart + 4;
  const fileEnd = raw.indexOf(`\r\n${boundary}`, fileStart);
  if (fileEnd === -1) {
    throw new WebImportError(400, 'Malformed multipart upload payload.');
  }

  return {
    filename,
    buffer: body.subarray(fileStart, fileEnd),
  };
}

export function isImportRoute(req: http.IncomingMessage): boolean {
  const pathname = (req.url ?? '/').split('?')[0];
  return req.method === 'POST' && (pathname === '/import/pdf' || pathname === '/import/identifier');
}

export async function handleImportRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  service: WebImportService = new WebImportService(),
): Promise<void> {
  const pathname = (req.url ?? '/').split('?')[0];

  try {
    if (pathname === '/import/pdf') {
      const body = await readBody(req);
      const file = parseMultipartPdf(body, req.headers['content-type']);
      const result = await service.importPdf(file.buffer, file.filename);
      sendJson(res, 200, result);
      return;
    }

    if (pathname === '/import/identifier') {
      const body = await readBody(req);
      const payload = body.length > 0 ? JSON.parse(body.toString('utf-8')) : {};
      const result = await service.importByIdentifier(payload);
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

    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
}
