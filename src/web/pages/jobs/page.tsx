import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { JobStatus } from '@shared';
import { getResearchClawClient } from '../../../renderer/hooks/use-ipc';

function requireClient() {
  const client = getResearchClawClient();
  if (!client) {
    throw new Error('ResearchClaw web client is not configured.');
  }

  return client;
}

function isRecoverableJob(job: JobStatus) {
  return job.state === 'queued' || job.state === 'running';
}

function sortJobs(jobs: JobStatus[]) {
  return [...jobs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function upsertJob(currentJobs: JobStatus[], nextJob: JobStatus) {
  const remainingJobs = currentJobs.filter((job) => job.jobId !== nextJob.jobId);
  return sortJobs([nextJob, ...remainingJobs]);
}

function formatUpdatedAt(updatedAt: string) {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) {
    return updatedAt;
  }

  return new Date(timestamp).toLocaleString();
}

export function JobsPage() {
  const { t } = useTranslation();
  const client = useMemo(() => requireClient(), []);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribeFns: Array<() => void> = [];

    async function loadJobs() {
      setLoading(true);
      setError(null);

      try {
        const snapshot = sortJobs(await client.listJobStatus());
        if (cancelled) {
          return;
        }

        setJobs(snapshot);
        setLoading(false);

        const nextUnsubscribeFns = await Promise.all(
          snapshot.filter(isRecoverableJob).map((job) =>
            client.subscribeJobEvents(job.jobId, (event) => {
              if (cancelled) {
                return;
              }

              setJobs((currentJobs) => upsertJob(currentJobs, event.job));
            }),
          ),
        );

        if (cancelled) {
          nextUnsubscribeFns.forEach((unsubscribe) => unsubscribe());
          return;
        }

        unsubscribeFns = nextUnsubscribeFns;
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : String(requestError));
        setLoading(false);
      }
    }

    void loadJobs();

    return () => {
      cancelled = true;
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  }, [client]);

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-notion-text">
              {t('web.jobs.title')}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-notion-text-secondary">
              {t('web.jobs.subtitle')}
            </p>
            {error ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="rounded-lg border border-notion-border px-3 py-2 text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
            >
              {t('web.jobs.backLibrary')}
            </Link>
            <Link
              to="/search"
              className="rounded-lg border border-notion-border px-3 py-2 text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
            >
              {t('web.jobs.backSearch')}
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-notion-text-secondary">{t('common.loading')}</p>
        ) : jobs.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-notion-border bg-notion-sidebar p-6 text-sm text-notion-text-secondary">
            {t('web.jobs.empty')}
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {jobs.map((job) => (
              <article
                key={job.jobId}
                className="rounded-xl border border-notion-border bg-white p-4 transition-colors duration-150 hover:border-notion-accent/30 hover:bg-notion-accent-light"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-notion-text-tertiary">
                      <span>{job.jobId}</span>
                      <span className="rounded-full bg-notion-sidebar px-2 py-1 normal-case tracking-normal text-notion-text-secondary">
                        {job.kind}
                      </span>
                      <span className="rounded-full bg-notion-accent-light px-2 py-1 normal-case tracking-normal text-notion-accent">
                        {job.state}
                      </span>
                    </div>

                    {job.message ? (
                      <p className="text-sm font-medium text-notion-text">{job.message}</p>
                    ) : null}

                    <p className="text-xs text-notion-text-tertiary">
                      {t('web.jobs.updatedLabel')}: {formatUpdatedAt(job.updatedAt)}
                    </p>
                  </div>

                  {typeof job.progress === 'number' ? (
                    <div className="w-full max-w-44 space-y-2 sm:w-44">
                      <div className="flex items-center justify-between text-xs font-medium text-notion-text-secondary">
                        <span>{t('web.jobs.progressLabel')}</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-notion-sidebar">
                        <div
                          className="h-full rounded-full bg-notion-accent transition-[width] duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
