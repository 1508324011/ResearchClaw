import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PaperSummary } from '@shared';
import { getResearchClawClient } from '../../../renderer/hooks/use-ipc';

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

export function LibraryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = useMemo(() => requireClient(), []);
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void client
      .listPapers({})
      .then((response) => {
        if (cancelled) {
          return;
        }

        setPapers(response.items);
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
  }, [client]);

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextIdentifier = identifier.trim();
    if (!nextIdentifier) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await client.importByIdentifier({ value: nextIdentifier, kind: 'arxiv' });
      setPapers((current) => {
        const deduped = current.filter((paper) => paper.id !== result.paper.id);
        return [result.paper, ...deduped];
      });
      setIdentifier('');
      navigate(`/papers/${result.paper.id}/reader`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
          <div className="mb-5 space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-notion-text">
              {t('web.library.title')}
            </h2>
            <p className="text-sm leading-6 text-notion-text-secondary">
              {t('web.library.subtitle')}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-notion-text-secondary">{t('common.loading')}</p>
          ) : papers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-notion-border bg-notion-sidebar p-6 text-sm text-notion-text-secondary">
              {t('web.library.empty')}
            </div>
          ) : (
            <div className="grid gap-3">
              {papers.map((paper) => (
                <article
                  key={paper.id}
                  className="group rounded-xl border border-notion-border bg-white p-4 transition-colors duration-150 hover:border-notion-accent/30 hover:bg-notion-accent-light"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-notion-text-tertiary">
                        {paper.shortId ?? t('web.library.localPaper')}
                      </p>
                      <h3 className="text-lg font-semibold leading-6 text-notion-text">
                        {paper.title}
                      </h3>
                      <p className="text-sm text-notion-text-secondary">
                        {formatAuthors(paper.authors)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      <Link
                        to={`/papers/${paper.id}/reader`}
                        className="rounded-lg border border-notion-border px-3 py-2 text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
                      >
                        {t('web.library.openReader')}
                      </Link>
                      <Link
                        to={`/papers/${paper.id}/notes`}
                        className="rounded-lg bg-notion-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                      >
                        {t('web.library.openNotes')}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
          <div className="mb-4 space-y-1">
            <h2 className="text-lg font-semibold text-notion-text">
              {t('web.library.importTitle')}
            </h2>
            <p className="text-sm leading-6 text-notion-text-secondary">
              {t('web.library.importHint')}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleImport}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-notion-text" htmlFor="web-library-import">
                {t('web.library.importLabel')}
              </label>
              <input
                id="web-library-import"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder={t('web.library.importPlaceholder')}
                className="w-full rounded-xl border border-notion-border bg-notion-sidebar px-3 py-3 text-sm text-notion-text outline-none transition-colors focus:border-notion-accent/40 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || identifier.trim().length === 0}
              className="w-full rounded-xl bg-notion-accent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t('web.library.importing') : t('web.library.importAction')}
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
