import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '../../support/render-utils';
import {
  clearResearchClawClient,
  setResearchClawClient,
} from '../../../src/renderer/hooks/use-ipc';
import { webRoutes } from '../../../src/web/router';
import { createMockClient, createPaperSummary } from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  clearResearchClawClient();
});

describe('web reader and notes pages', () => {
  it('loads reading detail and saves notes through the browser notes page', async () => {
    const paper = createPaperSummary({ id: 'paper-1', title: 'Graph Foundations' });
    const { client, spies } = createMockClient({
      readingDetail: {
        paper,
        pdfUrl: '/papers/paper-1/pdf',
        note: {
          id: 'note-1',
          paperId: 'paper-1',
          title: 'Reading note',
          content: { Summary: 'Original note summary.' },
          createdAt: '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T00:00:00.000Z',
        },
      },
    });
    setResearchClawClient(client);

    const router = createMemoryRouter(webRoutes, {
      initialEntries: ['/papers/paper-1/reader'],
    });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Graph Foundations')).toBeInTheDocument();
    expect(await screen.findByTitle('web.reader.pdfFrame')).toHaveAttribute(
      'src',
      '/papers/paper-1/pdf',
    );
    expect(screen.getByText('Original note summary.')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'web.reader.openNotes' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/paper-1/notes');
    });

    const editor = await screen.findByLabelText('web.notes.editorLabel');
    fireEvent.change(editor, { target: { value: 'Updated browser notes' } });
    await waitFor(() => {
      expect(editor).toHaveValue('Updated browser notes');
    });
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(spies.saveReadingNote).toHaveBeenCalledWith({
        paperId: 'paper-1',
        noteId: 'note-1',
        title: 'Reading note',
        content: { Summary: 'Updated browser notes' },
      });
    });
  });

  it('preserves structured note fields when saving through the browser notes page', async () => {
    const paper = createPaperSummary({ id: 'paper-1', title: 'Graph Foundations' });
    const { client, spies } = createMockClient({
      readingDetail: {
        paper,
        pdfUrl: '/papers/paper-1/pdf',
        note: {
          id: 'note-2',
          paperId: 'paper-1',
          title: 'Structured reading note',
          content: {
            summary: 'Original structured summary.',
            Questions: ['What changed?'],
            Metadata: { section: 'intro' },
          },
          createdAt: '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T00:00:00.000Z',
        },
      },
    });
    setResearchClawClient(client);

    const router = createMemoryRouter(webRoutes, {
      initialEntries: ['/papers/paper-1/reader'],
    });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(await screen.findByRole('link', { name: 'web.reader.openNotes' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/paper-1/notes');
    });

    const editor = await screen.findByLabelText('web.notes.editorLabel');
    expect(editor).toHaveValue('Original structured summary.');
    expect(screen.getByText('web.notes.structuredHint')).toBeInTheDocument();

    fireEvent.change(editor, { target: { value: 'Updated structured summary.' } });
    await waitFor(() => {
      expect(editor).toHaveValue('Updated structured summary.');
    });
    await user.click(screen.getByRole('button', { name: 'common.save' }));

    await waitFor(() => {
      expect(spies.saveReadingNote).toHaveBeenCalledWith({
        paperId: 'paper-1',
        noteId: 'note-2',
        title: 'Structured reading note',
        content: {
          summary: 'Updated structured summary.',
          Questions: ['What changed?'],
          Metadata: { section: 'intro' },
        },
      });
    });
  });
});
