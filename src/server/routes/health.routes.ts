import type http from 'http';
import type { ServerConfig } from '../config/server-config';

export const FIRST_SLICE_ROUTE_PREFIXES = ['/papers', '/reading', '/search', '/jobs'] as const;

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function isHealthRoute(req: http.IncomingMessage): boolean {
  return req.method === 'GET' && (req.url ?? '/') === '/health';
}

export function handleHealthRoute(res: http.ServerResponse, config: ServerConfig): void {
  sendJson(res, 200, {
    status: 'ok',
    mode: config.mode,
    storageDir: config.storageDir,
    routes: [...FIRST_SLICE_ROUTE_PREFIXES],
  });
}
