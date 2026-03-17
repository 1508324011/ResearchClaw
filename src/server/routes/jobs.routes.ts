import http from 'http';
import { JobStatusSchema, JobStreamEventSchema, type JobStreamEvent } from '@shared';
import { jobBus, type JobBus } from '../jobs/job-bus';

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function getPathname(req: http.IncomingMessage): string {
  return (req.url ?? '/').split('?')[0];
}

function sendSseEvent(res: http.ServerResponse, event: JobStreamEvent): void {
  if (res.writableEnded || res.destroyed) {
    return;
  }

  const normalizedEvent = JobStreamEventSchema.parse(event);
  res.write(`data: ${JSON.stringify(normalizedEvent)}\n\n`);
}

function startSse(res: http.ServerResponse): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  res.flushHeaders?.();
}

function streamJobs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  bus: JobBus,
  jobId?: string,
): void {
  startSse(res);

  const snapshots = jobId ? [bus.get(jobId)].filter(Boolean) : bus.list();
  for (const snapshot of snapshots) {
    if (!snapshot) {
      continue;
    }

    sendSseEvent(res, { type: 'snapshot', job: snapshot });
  }

  const unsubscribe = bus.subscribe((event) => {
    if (jobId && event.job.jobId !== jobId) {
      return;
    }

    sendSseEvent(res, event);
  });

  const cleanup = () => {
    unsubscribe();
    if (!res.writableEnded) {
      res.end();
    }
  };

  req.once('close', cleanup);
  res.once('close', cleanup);
}

export function isJobsRoute(req: http.IncomingMessage): boolean {
  const pathname = getPathname(req);
  return (
    req.method === 'GET' &&
    (pathname === '/jobs' || pathname === '/jobs/stream' || pathname.startsWith('/jobs/'))
  );
}

export function handleJobsRoute(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  bus: JobBus = jobBus,
): void {
  const pathname = getPathname(req);

  if (pathname === '/jobs') {
    sendJson(
      res,
      200,
      bus.list().map((job) => JobStatusSchema.parse(job)),
    );
    return;
  }

  if (pathname === '/jobs/stream') {
    streamJobs(req, res, bus);
    return;
  }

  const jobStreamMatch = pathname.match(/^\/jobs\/([^/]+)\/stream$/);
  if (jobStreamMatch) {
    streamJobs(req, res, bus, decodeURIComponent(jobStreamMatch[1]));
    return;
  }

  const jobStatusMatch = pathname.match(/^\/jobs\/([^/]+)$/);
  if (jobStatusMatch) {
    const jobId = decodeURIComponent(jobStatusMatch[1]);
    const job = bus.get(jobId);
    if (!job) {
      sendJson(res, 404, { error: 'Job not found' });
      return;
    }

    sendJson(res, 200, JobStatusSchema.parse(job));
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}
