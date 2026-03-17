import type http from 'http';

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function isReadingRoute(req: http.IncomingMessage): boolean {
  const pathname = (req.url ?? '/').split('?')[0];
  return req.method === 'GET' && (pathname === '/reading' || pathname.startsWith('/reading/'));
}

export function handleReadingRoute(res: http.ServerResponse): void {
  sendJson(res, 501, {
    route: 'reading',
    message: 'Task 3 server skeleton does not implement reading yet.',
  });
}
