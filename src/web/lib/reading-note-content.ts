import type { ReadingNote, ReadingNoteContent } from '@shared';

const DEFAULT_NOTE_TEXT_KEY = 'Summary';
const PREFERRED_NOTE_TEXT_KEYS = ['Summary', 'summary'] as const;

export interface NoteEditorState {
  draft: string;
  mode: 'text' | 'json';
  primaryTextKey: string;
  hasStructuredRemainder: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getPrimaryTextEntry(content: ReadingNoteContent): [string, string] | null {
  const entries = Object.entries(content);

  for (const key of PREFERRED_NOTE_TEXT_KEYS) {
    const value = content[key];
    if (typeof value === 'string') {
      return [key, value];
    }
  }

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      return [key, value];
    }
  }

  return null;
}

export function getNoteEditorState(note: ReadingNote | null | undefined): NoteEditorState {
  if (!note) {
    return {
      draft: '',
      mode: 'text',
      primaryTextKey: DEFAULT_NOTE_TEXT_KEY,
      hasStructuredRemainder: false,
    };
  }

  const primaryTextEntry = getPrimaryTextEntry(note.content);
  if (primaryTextEntry) {
    const [primaryTextKey, draft] = primaryTextEntry;
    return {
      draft,
      mode: 'text',
      primaryTextKey,
      hasStructuredRemainder: Object.keys(note.content).some((key) => key !== primaryTextKey),
    };
  }

  return {
    draft: JSON.stringify(note.content, null, 2),
    mode: 'json',
    primaryTextKey: DEFAULT_NOTE_TEXT_KEY,
    hasStructuredRemainder: Object.keys(note.content).length > 0,
  };
}

export function getNotePreviewText(note: ReadingNote | null | undefined): string {
  return getNoteEditorState(note).draft;
}

export function buildNoteContentFromDraft(
  note: ReadingNote | null | undefined,
  draft: string,
): ReadingNoteContent {
  const editorState = getNoteEditorState(note);
  if (editorState.mode === 'json') {
    const parsed = JSON.parse(draft) as unknown;
    if (!isRecord(parsed)) {
      throw new Error('Structured reading notes must be a JSON object.');
    }

    return parsed;
  }

  if (!note) {
    return { [editorState.primaryTextKey]: draft };
  }

  return {
    ...note.content,
    [editorState.primaryTextKey]: draft,
  };
}
