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

describe('web paper overview page', () => {
  it('opens a library paper in the browser overview flow', async () => {
    const paper = createPaperSummary({
      id: 'paper-1',
      shortId: '2503.00001',
      title: 'Graph Foundations',
      authors: ['Ada Lovelace', 'Grace Hopper'],
      abstract: 'A detailed overview abstract for the browser workflow.',
      sourceUrl: 'https://example.com/papers/graph-foundations',
    });
    const { client, spies } = createMockClient({
      papers: [paper],
      searchResults: [paper],
      importedPaper: paper,
    });
    setResearchClawClient(client);

    const router = createWebTestRouter(['/']);

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(
      await screen.findByRole('button', { name: /Graph Foundations Ada Lovelace, Grace Hopper/ }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/2503.00001');
    });

    expect(await screen.findByRole('heading', { name: 'Graph Foundations' })).toBeInTheDocument();
    expect(spies.getPaperDetail).toHaveBeenCalledWith({ paperId: 'paper-1' });
    expect(screen.getByText('Ada Lovelace, Grace Hopper')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Reader' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Source' })).toBeInTheDocument();
  });

  it('renders overview metadata and abstract from the browser paper detail route', async () => {
    const paper = createPaperSummary({
      id: 'paper-1',
      shortId: '2503.00001',
      title: 'Graph Foundations',
      authors: ['Ada Lovelace', 'Grace Hopper'],
      abstract: 'A detailed overview abstract for the browser workflow.',
      sourceUrl: 'https://example.com/papers/graph-foundations',
    });
    const { client } = createMockClient({
      papers: [paper],
      searchResults: [paper],
      importedPaper: paper,
    });
    setResearchClawClient(client);

    const router = createWebTestRouter(['/papers/2503.00001']);

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Graph Foundations' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace, Grace Hopper')).toBeInTheDocument();
    expect(
      screen.getByText('A detailed overview abstract for the browser workflow.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Reader' })).toBeInTheDocument();
  });
});
