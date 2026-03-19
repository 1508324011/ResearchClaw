import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SearchResultItem } from '@shared';
import { getResearchClawClient } from '../../../renderer/hooks/use-ipc';

function requireClient() {
  const client = getResearchClawClient();
  if (!client) {
    throw new Error('ResearchClaw web client is not configured.');
  }

  return client;
}

function formatMeta(result: SearchResultItem) {
  const yearPart = result.year ? String(result.year) : '—';
  const authorPart = result.authors.length > 0 ? result.authors.join(' · ') : '—';
  return `${authorPart} · ${yearPart}`;
}

export function SearchPage() {
  const { t } = useTranslation();
  const client = useMemo(() => requireClient(), []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await client.search({ query: nextQuery, limit: 20, mode: 'text' });
      setResults(response.results);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-notion-text">
              {t('web.search.title')}
            </h2>
            <p className="text-sm leading-6 text-notion-text-secondary">
              {t('web.search.subtitle')}
            </p>
          </div>

          <Link
            to="/jobs"
            className="rounded-lg border border-notion-border px-3 py-2 text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
          >
            {t('web.search.openJobs')}
          </Link>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <div className="min-w-0 flex-1 space-y-2">
            <label className="text-sm font-medium text-notion-text" htmlFor="web-search-query">
              {t('web.search.queryLabel')}
            </label>
            <input
              id="web-search-query"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search.placeholder')}
              className="w-full rounded-xl border border-notion-border bg-notion-sidebar px-3 py-3 text-sm text-notion-text outline-none transition-colors focus:border-notion-accent/40 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading || query.trim().length === 0}
            className="self-end rounded-xl bg-notion-accent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('web.search.searchAction')}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {results.map((result) => (
          <Link
            key={result.id}
            to={`/papers/${result.id}`}
            state={{ from: '/search' }}
            className="block rounded-2xl border border-notion-border bg-white p-5 shadow-notion transition-colors duration-150 hover:border-notion-accent/30 hover:bg-notion-accent-light"
          >
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-notion-text-tertiary">
                {result.shortId ?? t('web.library.localPaper')}
              </p>
              <h3 className="text-lg font-semibold leading-6 text-notion-text">{result.title}</h3>
              <p className="text-sm text-notion-text-secondary">{formatMeta(result)}</p>
              {result.abstract ? (
                <p className="line-clamp-2 text-sm leading-6 text-notion-text-secondary">
                  {result.abstract}
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
