import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GetReadingDetailResponse } from '@shared';
import { getResearchClawClient } from '../../../../renderer/hooks/use-ipc';
import { buildNoteContentFromDraft, getNoteEditorState } from '../../../lib/reading-note-content';

function requireClient() {
  const client = getResearchClawClient();
  if (!client) {
    throw new Error('ResearchClaw web client is not configured.');
  }

  return client;
}

export function NotesPage() {
  const { t } = useTranslation();
  const { paperId } = useParams<{ paperId: string }>();
  const client = useMemo(() => requireClient(), []);
  const [detail, setDetail] = useState<GetReadingDetailResponse | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorState = useMemo(() => getNoteEditorState(detail?.note), [detail?.note]);

  useEffect(() => {
    if (!paperId) {
      setError(t('web.notes.missingPaperId'));
      setLoading(false);
      return;
    }

    let cancelled = false;
    void client
      .getReadingDetail({ paperId })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setDetail(response);
        setDraft(getNoteEditorState(response.note).draft);
        setLoading(false);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : String(requestError));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client, paperId]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paperId || !detail) {
      return;
    }

    const submittedDraft = editorRef.current?.value ?? draft;

    let content: GetReadingDetailResponse['note'] extends { content: infer T } ? T : never;
    try {
      content = buildNoteContentFromDraft(detail.note, submittedDraft);
    } catch {
      setError(t('web.notes.invalidJson'));
      setSaved(false);
      return;
    }

    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const response = await client.saveReadingNote({
        paperId,
        noteId: detail.note?.id,
        title: detail.note?.title ?? t('web.notes.defaultTitle'),
        content,
      });

      setDetail({
        ...detail,
        note: response.note,
      });
      setDraft(getNoteEditorState(response.note).draft);
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-notion-text-secondary">{t('common.loading')}</p>;
  }

  if (error || !detail) {
    return (
      <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
        {error ?? t('web.notes.unavailable')}
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-notion-border bg-white p-6 shadow-notion">
      <div className="mb-6 flex flex-col gap-3 border-b border-notion-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-notion-text-tertiary">
            {detail.paper.shortId ?? t('web.library.localPaper')}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-notion-text">
            {t('web.notes.title')}
          </h2>
          <p className="text-sm text-notion-text-secondary">{detail.paper.title}</p>
        </div>

        <Link
          to={`/papers/${detail.paper.id}/reader`}
          className="rounded-lg border border-notion-border px-3 py-2 text-sm text-notion-text-secondary transition-colors hover:border-notion-accent/30 hover:text-notion-accent"
        >
          {t('common.back')}
        </Link>
      </div>

      <form className="space-y-4" onSubmit={handleSave}>
        <div className="space-y-2">
          <label className="text-sm font-medium text-notion-text" htmlFor="web-notes-editor">
            {t('web.notes.editorLabel')}
          </label>
          {detail.note && editorState.hasStructuredRemainder ? (
            <p className="rounded-xl border border-notion-accent/20 bg-notion-accent-light px-3 py-2 text-sm text-notion-text-secondary">
              {editorState.mode === 'json'
                ? t('web.notes.jsonHint')
                : t('web.notes.structuredHint')}
            </p>
          ) : null}
          <textarea
            id="web-notes-editor"
            name="draft"
            ref={editorRef}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaved(false);
            }}
            rows={14}
            className="w-full rounded-2xl border border-notion-border bg-notion-sidebar px-4 py-4 text-sm leading-7 text-notion-text outline-none transition-colors focus:border-notion-accent/40 focus:bg-white"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-notion-text-secondary">{t('web.notes.saveHint')}</p>
          <div className="flex items-center gap-3">
            {saved ? <span className="text-sm text-green-700">{t('common.saved')}</span> : null}
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-notion-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
