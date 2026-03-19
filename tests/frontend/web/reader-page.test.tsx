import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '../../support/render-utils';
import {
  clearResearchClawClient,
  setResearchClawClient,
} from '../../../src/renderer/hooks/use-ipc';
import { createMockClient, createPaperSummary, createWebTestRouter } from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  clearResearchClawClient();
});

describe('web reader and notes pages', () => {
  it('loads canonical notes content and opens the reader through shortId routes', async () => {
    const paper = createPaperSummary({
      id: 'paper-1',
      shortId: '2503.00001',
      title: 'Graph Foundations',
    });
    const { client } = createMockClient({
      papers: [paper],
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

    const router = createWebTestRouter(['/papers/2503.00001/notes']);

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Graph Foundations')).toBeInTheDocument();
    expect(screen.getByText('Original note summary.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reader' })).toBeInTheDocument();
    expect(screen.getByText('No PDF downloaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reader' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/2503.00001/reader');
    });

    expect(await screen.findByText('No PDF downloaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });

  it('loads structured notes on the canonical notes route', async () => {
    const paper = createPaperSummary({
      id: 'paper-1',
      shortId: '2503.00001',
      title: 'Graph Foundations',
    });
    const { client } = createMockClient({
      papers: [paper],
      readingDetail: {
        paper,
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

    const router = createWebTestRouter(['/papers/2503.00001/notes']);

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Original structured summary.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/papers/2503.00001/notes');
  });

  it('shows canonical reader controls and empty-pdf state in browser mode', async () => {
    const paper = createPaperSummary({
      id: 'paper-1',
      shortId: '2503.00001',
      title: 'Graph Foundations',
    });
    const { client } = createMockClient({
      papers: [paper],
      readingDetail: {
        paper,
        note: null,
      },
    });
    setResearchClawClient(client);

    const router = createWebTestRouter(['/papers/2503.00001/reader']);

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Graph Foundations')).toBeInTheDocument();
    expect(screen.getByTitle('Chat only')).toBeInTheDocument();
    expect(screen.getByTitle('Split view')).toBeInTheDocument();
    expect(screen.getByTitle('PDF only')).toBeInTheDocument();
    expect(screen.getByText('No PDF downloaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/papers/2503.00001/reader');
  });
});
