import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GetReadingDetailResponse } from '@shared';
import { getResearchClawClient } from '../../../../renderer/hooks/use-ipc';

function requireClient() {
  const client = getResearchClawClient();
  if (!client) {
    throw new Error('ResearchClaw web client is not configured.');
  }

  return client;
}

function noteToText(note: GetReadingDetailResponse['note']) {
  if (!note) {
    return '';
  }

  return Object.values(note.content)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n\n');
}

export function ReaderPage() {
  const { t } = useTranslation();
  const { paperId } = useParams<{ paperId: string }>();
  const client = useMemo(() => requireClient(), []);
  const [detail, setDetail] = useState<GetReadingDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId) {
      setError('Missing paper id.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    void client
      .getReadingDetail({ paperId })
      .then((response) => {
        if (!cancelled) {
          setDetail(response);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : String(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, paperId]);

  if (loading) {
    return <p className="text-sm text-notion-text-secondary">{t('common.loading')}</p>;
  }

  if (error || !detail) {
    return (
      <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
        {error ?? 'Reader unavailable.'}
      </p>
    );
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <article className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-notion-text-tertiary">
            {detail.paper.shortId ?? t('web.library.localPaper')}
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-notion-text">
            {detail.paper.title}
          </h2>
          <p className="text-sm text-notion-text-secondary">
            {detail.paper.authors.join(' · ') || '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-notion-border bg-notion-sidebar p-5">
          <h3 className="mb-2 text-sm font-medium text-notion-text">{t('papers.reader')}</h3>
          <p className="whitespace-pre-wrap text-sm leading-7 text-notion-text-secondary">
            {detail.paper.abstract ?? t('web.reader.noAbstract')}
          </p>
        </div>
      </article>

      <aside className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-notion-text">{t('papers.notes')}</h3>
            <p className="text-sm text-notion-text-secondary">{t('web.reader.notesSubtitle')}</p>
          </div>
          <Link
            to={`/papers/${detail.paper.id}/notes`}
            className="rounded-lg bg-notion-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t('web.reader.openNotes')}
          </Link>
        </div>

        {detail.note ? (
          <p className="whitespace-pre-wrap text-sm leading-7 text-notion-text-secondary">
            {noteToText(detail.note)}
          </p>
        ) : (
          <p className="text-sm text-notion-text-secondary">{t('web.reader.emptyNote')}</p>
        )}
      </aside>
    </section>
  );
}
