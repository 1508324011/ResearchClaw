import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
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
    expect(screen.getByText('Original note summary.')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'web.reader.openNotes' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/paper-1/notes');
    });

    const editor = await screen.findByLabelText('web.notes.editorLabel');
    await user.clear(editor);
    await user.type(editor, 'Updated browser notes');
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
});
