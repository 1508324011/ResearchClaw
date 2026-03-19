import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GetPaperDetailResponse } from '@shared';
import { getResearchClawClient } from '../../../../renderer/hooks/use-ipc';

function requireClient() {
  const client = getResearchClawClient();
  if (!client) {
    throw new Error('ResearchClaw web client is not configured.');
  }

  return client;
}

function formatAuthors(authors: string[]) {
  return authors.length > 0 ? authors.join(' · ') : '—';
}

function getBackHref(state: unknown) {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return '/';
  }

  const from = (state as { from?: unknown }).from;
  return typeof from === 'string' ? from : '/';
}

export function PaperOverviewPage() {
  const { t } = useTranslation();
  const client = useMemo(() => requireClient(), []);
  const { paperId } = useParams<{ paperId: string }>();
  const location = useLocation();
  const [detail, setDetail] = useState<GetPaperDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId) {
      setError(t('web.paperOverview.notFound'));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void client
      .getPaperDetail({ paperId })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setDetail(response);
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : String(requestError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, paperId, t]);

  const backHref = getBackHref(location.state);

  if (loading) {
    return (
      <section className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
        <p className="text-sm text-notion-text-secondary">{t('common.loading')}</p>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="space-y-4">
        <Link
          to={backHref}
          className="inline-flex rounded-lg border border-notion-border px-3 py-2 text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
        >
          {t('web.paperOverview.back')}
        </Link>

        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 shadow-notion">
          {error ?? t('web.paperOverview.notFound')}
        </div>
      </section>
    );
  }

  const { paper } = detail;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backHref}
          className="inline-flex rounded-lg border border-notion-border px-3 py-2 text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
        >
          {t('web.paperOverview.back')}
        </Link>

        <p className="text-xs font-medium uppercase tracking-[0.24em] text-notion-text-tertiary">
          {paper.shortId ?? t('web.library.localPaper')}
        </p>
      </div>

      <article className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-notion-text">{paper.title}</h2>
          <div className="flex flex-wrap gap-4 text-sm text-notion-text-secondary">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-notion-text">{t('web.paperOverview.authors')}</span>
              <span>{formatAuthors(paper.authors)}</span>
            </div>

            {paper.year ? (
              <div className="flex items-center gap-2">
                <span className="font-medium text-notion-text">{t('web.paperOverview.year')}</span>
                <span>{paper.year}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/papers/${paper.id}/reader`}
            state={{ from: `/papers/${paper.id}` }}
            className="rounded-lg bg-notion-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t('web.paperOverview.openReader')}
          </Link>
          <Link
            to={`/papers/${paper.id}/notes`}
            state={{ from: `/papers/${paper.id}` }}
            className="rounded-lg border border-notion-border px-4 py-2.5 text-sm font-medium text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
          >
            {t('web.paperOverview.openNotes')}
          </Link>
          {paper.sourceUrl ? (
            <a
              href={paper.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-notion-border px-4 py-2.5 text-sm font-medium text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
            >
              {t('web.paperOverview.openSource')}
            </a>
          ) : null}
        </div>
      </article>

      {paper.abstract ? (
        <article className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-notion-text-tertiary">
            {t('web.paperOverview.abstract')}
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-7 text-notion-text-secondary">
            {paper.abstract}
          </p>
        </article>
      ) : null}
    </section>
  );
}
