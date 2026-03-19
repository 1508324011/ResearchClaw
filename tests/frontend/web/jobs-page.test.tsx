import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { JobStatus, JobStreamEvent } from '@shared';
import {
  clearResearchClawClient,
  setResearchClawClient,
} from '../../../src/renderer/hooks/use-ipc';
import { createMockClient, createWebTestRouter } from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function createJobStatus(overrides: Partial<JobStatus> = {}): JobStatus {
  return {
    jobId: 'job-running',
    kind: 'analysis',
    state: 'running',
    message: 'Embedding paper',
    progress: 45,
    updatedAt: '2026-03-19T10:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  clearResearchClawClient();
});

describe('web jobs page', () => {
  it('recovers current jobs and keeps progress visible after a refresh', async () => {
    const runningJob = createJobStatus();
    const queuedJob = createJobStatus({
      jobId: 'job-queued',
      kind: 'import',
      state: 'queued',
      message: 'Waiting for import slot',
      progress: 0,
      updatedAt: '2026-03-19T09:55:00.000Z',
    });
    const progressEvent: JobStreamEvent = {
      type: 'progress',
      job: createJobStatus({
        progress: 80,
        updatedAt: '2026-03-19T10:05:00.000Z',
      }),
    };

    let jobs = [runningJob, queuedJob];
    let runningSubscription: ((event: JobStreamEvent) => void) | null = null;

    const { client, spies } = createMockClient();
    setResearchClawClient(client);

    spies.listJobStatus.mockImplementation(async () => jobs);
    spies.subscribeJobEvents.mockImplementation(async (jobId, onEvent) => {
      if (jobId === runningJob.jobId) {
        runningSubscription = onEvent;
      }

      return () => undefined;
    });

    const firstRouter = createWebTestRouter(['/jobs']);
    const firstRender = render(<RouterProvider router={firstRouter} />);

    expect(await screen.findByText('job-running')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === '45%')).toBeInTheDocument();
    expect(screen.getByText('Embedding paper')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'web.jobs.backLibrary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'web.jobs.backSearch' })).toBeInTheDocument();

    await waitFor(() => {
      expect(spies.subscribeJobEvents).toHaveBeenCalledWith('job-running', expect.any(Function));
    });

    await act(async () => {
      jobs = [progressEvent.job, queuedJob];
      runningSubscription?.(progressEvent);
    });

    await screen.findByText((_, element) => element?.textContent === '80%');

    firstRender.unmount();

    const secondRouter = createWebTestRouter(['/jobs']);
    render(<RouterProvider router={secondRouter} />);

    expect(await screen.findByText('job-running')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === '80%')).toBeInTheDocument();

    await waitFor(() => {
      expect(spies.listJobStatus).toHaveBeenCalledTimes(2);
    });
  });
});
