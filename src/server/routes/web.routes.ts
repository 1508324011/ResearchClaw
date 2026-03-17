import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { DEFAULT_WEB_ROOT_DIR, type ServerConfig } from '../config/server-config';

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

const SPA_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/search$/,
  /^\/papers\/[^/]+\/reader$/,
  /^\/papers\/[^/]+\/notes$/,
];

function getPathname(req: http.IncomingMessage): string {
  return new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
}

function wantsHtml(req: http.IncomingMessage): boolean {
  return (req.headers.accept ?? '').includes('text/html');
}

function matchesSpaRoute(pathname: string): boolean {
  return SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function looksLikeStaticAsset(pathname: string): boolean {
  return path.extname(pathname) !== '';
}

function getContentType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return HTML_CONTENT_TYPE;
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.ico':
      return 'image/x-icon';
    case '.map':
      return 'application/json; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveWebRoot(config: ServerConfig): string {
  return path.resolve(config.webRootDir ?? DEFAULT_WEB_ROOT_DIR);
}

function isWithinRoot(rootDir: string, filePath: string): boolean {
  return filePath === rootDir || filePath.startsWith(`${rootDir}${path.sep}`);
}

async function sendFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  filePath: string,
): Promise<void> {
  const contentType = getContentType(filePath);
  const cacheControl = contentType === HTML_CONTENT_TYPE ? 'no-cache' : 'public, max-age=3600';

  res.writeHead(200, {
    'content-type': contentType,
    'cache-control': cacheControl,
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(await fs.readFile(filePath));
}

export async function handleWebRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<boolean> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  const pathname = getPathname(req);
  const webRootDir = resolveWebRoot(config);
  const indexPath = path.join(webRootDir, 'index.html');

  if (matchesSpaRoute(pathname) && (pathname === '/' || wantsHtml(req))) {
    if (!(await fileExists(indexPath))) {
      return false;
    }

    await sendFile(req, res, indexPath);
    return true;
  }

  if (!looksLikeStaticAsset(pathname)) {
    return false;
  }

  const relativePath = pathname.replace(/^\//, '');
  const filePath = path.resolve(webRootDir, relativePath);
  if (!isWithinRoot(webRootDir, filePath)) {
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return true;
  }

  if (!(await fileExists(filePath))) {
    return false;
  }

  await sendFile(req, res, filePath);
  return true;
}
