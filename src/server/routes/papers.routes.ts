import type http from 'http';

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function isPapersRoute(req: http.IncomingMessage): boolean {
  return req.method === 'GET' && (req.url ?? '/').split('?')[0] === '/papers';
}

export function handlePapersRoute(res: http.ServerResponse): void {
  sendJson(res, 501, {
    route: 'papers',
    message: 'Task 3 server skeleton does not implement papers yet.',
  });
}
