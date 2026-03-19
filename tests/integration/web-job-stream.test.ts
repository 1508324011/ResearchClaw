import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import {
  JobStatusSchema,
  JobStreamEventSchema,
  type JobStreamEvent,
  type JobStatus,
} from '../../src/shared';
import { createResearchClawServerApp } from '../../src/server/app';
import { jobBus } from '../../src/server/jobs/job-bus';

const activeServers = new Set<import('node:http').Server>();

async function startServer() {
  const server = createResearchClawServerApp();
  activeServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function readSseEvents(
  response: Response,
  expectedCount: number,
  stop: () => void,
): Promise<JobStreamEvent[]> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: JobStreamEvent[] = [];
  let buffer = '';

  try {
    while (events.length < expectedCount) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer = `${buffer}${decoder.decode(value, { stream: true })}`.replace(/\r\n/g, '\n');
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        const line = chunk
          .split('\n')
          .map((entry) => entry.trim())
          .find((entry) => entry.startsWith('data: '));

        if (!line) {
          continue;
        }

        events.push(JobStreamEventSchema.parse(JSON.parse(line.slice(6))));

        if (events.length >= expectedCount) {
          stop();
          break;
        }
      }
    }
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) {
      throw error;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  return events;
}

function createJob(overrides: Partial<JobStatus> = {}): JobStatus {
  return JobStatusSchema.parse({
    jobId: 'job-1',
    kind: 'analysis',
    state: 'running',
    message: 'Embedding paper',
    progress: 20,
    updatedAt: '2026-03-17T12:00:00.000Z',
    ...overrides,
  });
}

beforeEach(() => {
  jobBus.reset();
});

afterEach(async () => {
  jobBus.reset();

  await Promise.all(
    Array.from(activeServers).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  activeServers.clear();
});

describe('web job routes', () => {
  it('lists jobs and returns a single job status by id', async () => {
    const queuedJob = createJob({
      jobId: 'job-queued',
      kind: 'import',
      state: 'queued',
      progress: 0,
      updatedAt: '2026-03-17T12:00:00.000Z',
    });

    const runningJob = createJob({
      jobId: 'job-running',
      kind: 'analysis',
      state: 'running',
      progress: 45,
      updatedAt: '2026-03-17T12:01:00.000Z',
    });

    jobBus.publish({ type: 'snapshot', job: queuedJob });
    jobBus.publish({ type: 'snapshot', job: runningJob });

    const { baseUrl } = await startServer();

    const listResponse = await fetch(`${baseUrl}/jobs`);
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as unknown[];
    expect(listed.map((item) => JobStatusSchema.parse(item).jobId)).toEqual([
      'job-running',
      'job-queued',
    ]);

    const detailResponse = await fetch(`${baseUrl}/jobs/job-running`);
    expect(detailResponse.status).toBe(200);
    const detail = JobStatusSchema.parse(await detailResponse.json());
    expect(detail.jobId).toBe('job-running');
    expect(detail.progress).toBe(45);
  });

  it('streams snapshot and progress events from the global SSE endpoint', async () => {
    const initialJob = createJob({
      jobId: 'job-global',
      progress: 20,
      updatedAt: '2026-03-17T12:00:00.000Z',
    });
    const progressEvent: JobStreamEvent = {
      type: 'progress',
      job: createJob({
        jobId: 'job-global',
        progress: 75,
        updatedAt: '2026-03-17T12:02:00.000Z',
      }),
    };

    jobBus.publish({ type: 'snapshot', job: initialJob });

    const { baseUrl } = await startServer();
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/jobs/stream`, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const eventsPromise = readSseEvents(response, 2, () => controller.abort());
    jobBus.publish(progressEvent);
    const events = await eventsPromise;

    expect(events).toEqual([{ type: 'snapshot', job: initialJob }, progressEvent]);
  });

  it('filters the job-specific SSE endpoint to the requested job id', async () => {
    const targetJob = createJob({
      jobId: 'job-target',
      progress: 10,
      updatedAt: '2026-03-17T12:00:00.000Z',
    });
    const otherJob = createJob({
      jobId: 'job-other',
      progress: 30,
      updatedAt: '2026-03-17T12:01:00.000Z',
    });

    jobBus.publish({ type: 'snapshot', job: targetJob });
    jobBus.publish({ type: 'snapshot', job: otherJob });

    const { baseUrl } = await startServer();
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/jobs/job-target/stream`, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);

    const doneEvent: JobStreamEvent = {
      type: 'done',
      job: createJob({
        jobId: 'job-target',
        state: 'completed',
        progress: 100,
        updatedAt: '2026-03-17T12:03:00.000Z',
      }),
    };

    const eventsPromise = readSseEvents(response, 2, () => controller.abort());
    jobBus.publish({
      type: 'progress',
      job: createJob({
        jobId: 'job-other',
        progress: 80,
        updatedAt: '2026-03-17T12:02:00.000Z',
      }),
    });
    jobBus.publish(doneEvent);
    const events = await eventsPromise;

    expect(events).toEqual([{ type: 'snapshot', job: targetJob }, doneEvent]);
  });

  it('supports job recovery by listing current jobs before later stream updates arrive', async () => {
    const recoverableJob = createJob({
      jobId: 'job-running',
      kind: 'analysis',
      state: 'running',
      progress: 45,
      updatedAt: '2026-03-17T12:00:00.000Z',
    });

    jobBus.publish({ type: 'snapshot', job: recoverableJob });

    const { baseUrl } = await startServer();

    const listResponse = await fetch(`${baseUrl}/jobs`);
    expect(listResponse.status).toBe(200);
    const listed = (await listResponse.json()) as unknown[];
    expect(listed).toEqual([recoverableJob]);

    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/jobs/job-running/stream`, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    });

    expect(response.status).toBe(200);

    const progressEvent: JobStreamEvent = {
      type: 'progress',
      job: createJob({
        jobId: 'job-running',
        kind: 'analysis',
        state: 'running',
        progress: 80,
        updatedAt: '2026-03-17T12:05:00.000Z',
      }),
    };

    const eventsPromise = readSseEvents(response, 2, () => controller.abort());
    jobBus.publish(progressEvent);
    const events = await eventsPromise;

    expect(events).toEqual([{ type: 'snapshot', job: recoverableJob }, progressEvent]);
  });
});
