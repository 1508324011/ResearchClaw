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

describe('web paper overview page', () => {
  it('opens a library paper in the browser overview flow', async () => {
    const paper = createPaperSummary({
      id: 'paper-1',
      title: 'Graph Foundations',
      authors: ['Ada Lovelace', 'Grace Hopper'],
      year: 2025,
      abstract: 'A detailed overview abstract for the browser workflow.',
      sourceUrl: 'https://example.com/papers/graph-foundations',
    });
    const { client, spies } = createMockClient({
      papers: [paper],
      searchResults: [paper],
      importedPaper: paper,
    });
    setResearchClawClient(client);

    const router = createMemoryRouter(webRoutes, {
      initialEntries: ['/'],
    });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(await screen.findByRole('link', { name: 'web.library.openOverview' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/paper-1');
    });

    expect(await screen.findByRole('heading', { name: 'Graph Foundations' })).toBeInTheDocument();
    expect(spies.getPaperDetail).toHaveBeenCalledWith({ paperId: 'paper-1' });
    expect(screen.getByRole('link', { name: 'web.paperOverview.openReader' })).toHaveAttribute(
      'href',
      '/papers/paper-1/reader',
    );
    expect(screen.getByRole('link', { name: 'web.paperOverview.openNotes' })).toHaveAttribute(
      'href',
      '/papers/paper-1/notes',
    );
    expect(screen.getByRole('link', { name: 'web.paperOverview.openSource' })).toHaveAttribute(
      'href',
      'https://example.com/papers/graph-foundations',
    );
  });

  it('renders overview metadata and abstract from the browser paper detail route', async () => {
    const paper = createPaperSummary({
      id: 'paper-1',
      title: 'Graph Foundations',
      authors: ['Ada Lovelace', 'Grace Hopper'],
      year: 2025,
      abstract: 'A detailed overview abstract for the browser workflow.',
      sourceUrl: 'https://example.com/papers/graph-foundations',
    });
    const { client } = createMockClient({
      papers: [paper],
      searchResults: [paper],
      importedPaper: paper,
    });
    setResearchClawClient(client);

    const router = createMemoryRouter(webRoutes, {
      initialEntries: ['/papers/paper-1'],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Graph Foundations' })).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace · Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(
      screen.getByText('A detailed overview abstract for the browser workflow.'),
    ).toBeInTheDocument();
  });
});
