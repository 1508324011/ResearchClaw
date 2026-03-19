import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PaperSummary } from '@shared';
import type { ResearchClawClient } from '../../renderer/lib/researchclaw-client';

type ImportTab = 'identifier' | 'pdf';
type IdentifierKind = 'arxiv' | 'doi' | 'url';

interface ImportWorkspaceProps {
  client: ResearchClawClient;
  onImported?: (paper: PaperSummary) => void;
}

interface ImportSuccessState {
  paper: PaperSummary;
  fileName?: string;
}

export function ImportWorkspace({ client, onImported }: ImportWorkspaceProps) {
  const { t } = useTranslation();
  const tabsId = useId();
  const [activeTab, setActiveTab] = useState<ImportTab>('identifier');
  const [identifierKind, setIdentifierKind] = useState<IdentifierKind>('arxiv');
  const [identifierValue, setIdentifierValue] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ImportSuccessState | null>(null);

  function resetStatus() {
    setError(null);
    setSuccess(null);
  }

  function handleTabChange(nextTab: ImportTab) {
    setActiveTab(nextTab);
    resetStatus();
  }

  async function handleIdentifierSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedValue = identifierValue.trim();
    if (!trimmedValue) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await client.importByIdentifier({
        kind: identifierKind,
        value: trimmedValue,
      });

      setIdentifierValue('');
      setSuccess({ paper: result.paper });
      onImported?.(result.paper);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePdfSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pdfFile) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await client.importPdf(pdfFile);

      setSuccess({
        paper: result.paper,
        fileName: pdfFile.name,
      });
      onImported?.(result.paper);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-notion-text">{t('web.import.title')}</h2>
        <p className="text-sm leading-6 text-notion-text-secondary">{t('web.import.subtitle')}</p>
      </div>

      <div
        className="mt-4 flex rounded-xl bg-notion-sidebar p-1"
        role="tablist"
        aria-label={t('web.import.title')}
      >
        <button
          id={`${tabsId}-identifier-tab`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'identifier'}
          aria-controls={`${tabsId}-identifier-panel`}
          onClick={() => handleTabChange('identifier')}
          className={[
            'w-1/2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'identifier'
              ? 'bg-white text-notion-text shadow-notion'
              : 'text-notion-text-secondary hover:text-notion-text',
          ].join(' ')}
        >
          {t('web.import.tabIdentifier')}
        </button>
        <button
          id={`${tabsId}-pdf-tab`}
          type="button"
          role="tab"
          aria-selected={activeTab === 'pdf'}
          aria-controls={`${tabsId}-pdf-panel`}
          onClick={() => handleTabChange('pdf')}
          className={[
            'w-1/2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            activeTab === 'pdf'
              ? 'bg-white text-notion-text shadow-notion'
              : 'text-notion-text-secondary hover:text-notion-text',
          ].join(' ')}
        >
          {t('web.import.tabPdf')}
        </button>
      </div>

      {activeTab === 'identifier' ? (
        <form
          className="mt-4 space-y-4"
          role="tabpanel"
          id={`${tabsId}-identifier-panel`}
          aria-labelledby={`${tabsId}-identifier-tab`}
          onSubmit={handleIdentifierSubmit}
        >
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-notion-text"
              htmlFor={`${tabsId}-identifier-kind`}
            >
              {t('web.import.identifierKind')}
            </label>
            <select
              id={`${tabsId}-identifier-kind`}
              value={identifierKind}
              onChange={(event) => {
                setIdentifierKind(event.target.value as IdentifierKind);
                resetStatus();
              }}
              className="w-full rounded-xl border border-notion-border bg-white px-3 py-3 text-sm text-notion-text outline-none transition-colors focus:border-notion-accent/40"
            >
              <option value="arxiv">{t('web.import.kindArxiv')}</option>
              <option value="doi">{t('web.import.kindDoi')}</option>
              <option value="url">{t('web.import.kindUrl')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-notion-text"
              htmlFor={`${tabsId}-identifier-value`}
            >
              {t('web.import.identifierValue')}
            </label>
            <input
              id={`${tabsId}-identifier-value`}
              type="text"
              value={identifierValue}
              onChange={(event) => {
                setIdentifierValue(event.target.value);
                resetStatus();
              }}
              placeholder={t('web.import.identifierPlaceholder')}
              className="w-full rounded-xl border border-notion-border bg-notion-sidebar px-3 py-3 text-sm text-notion-text outline-none transition-colors focus:border-notion-accent/40 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || identifierValue.trim().length === 0}
            className="w-full rounded-xl bg-notion-accent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t('web.import.importingIdentifier') : t('web.import.submit')}
          </button>
        </form>
      ) : (
        <form
          className="mt-4 space-y-4"
          role="tabpanel"
          id={`${tabsId}-pdf-panel`}
          aria-labelledby={`${tabsId}-pdf-tab`}
          onSubmit={handlePdfSubmit}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-notion-text" htmlFor={`${tabsId}-pdf-input`}>
              {t('web.import.pdfInput')}
            </label>
            <input
              id={`${tabsId}-pdf-input`}
              type="file"
              accept="application/pdf"
              onChange={(event) => {
                setPdfFile(event.target.files?.[0] ?? null);
                resetStatus();
              }}
              className="block w-full rounded-xl border border-notion-border bg-notion-sidebar px-3 py-3 text-sm text-notion-text file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-notion-text"
            />
            <p className="text-sm text-notion-text-secondary">{t('web.import.pdfHint')}</p>
            {pdfFile && !success ? (
              <p className="text-sm text-notion-text">{pdfFile.name}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting || !pdfFile}
            className="w-full rounded-xl bg-notion-accent px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t('web.import.importingPdf') : t('web.import.submit')}
          </button>
        </form>
      )}

      {error ? (
        <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {success ? (
        <div className="mt-4 space-y-3 rounded-xl border border-notion-accent/20 bg-notion-accent-light p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-notion-text">{t('web.import.successTitle')}</p>
            <p className="text-sm text-notion-text-secondary">{success.paper.title}</p>
            {success.fileName ? (
              <p className="text-xs text-notion-text-tertiary">{success.fileName}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to={`/papers/${success.paper.id}/reader`}
              className="rounded-lg bg-notion-accent px-3 py-2 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('web.import.openReader')}
            </Link>
            <Link
              to={`/papers/${success.paper.id}/notes`}
              className="rounded-lg border border-notion-border px-3 py-2 text-center text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
            >
              {t('web.import.openNotes')}
            </Link>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
