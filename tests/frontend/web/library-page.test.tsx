import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '../../support/render-utils';
import {
  setResearchClawClient,
  clearResearchClawClient,
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

describe('web library page', () => {
  it('routes library cards through the browser overview instead of exposing deeper actions directly', async () => {
    const { client } = createMockClient({
      papers: [createPaperSummary({ title: 'Graph Foundations' })],
    });
    setResearchClawClient(client);

    const router = createMemoryRouter(webRoutes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Graph Foundations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'web.library.openOverview' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'web.library.openReader' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'web.library.openNotes' })).not.toBeInTheDocument();
  });

  it('lists papers and imports a new paper through the browser workspace', async () => {
    const importedPaper = createPaperSummary({
      id: 'paper-2',
      shortId: '2401.01234',
      title: 'Imported Planning Paper',
    });
    const { client, spies } = createMockClient({
      papers: [createPaperSummary({ title: 'Graph Foundations' })],
      importedPaper,
    });
    setResearchClawClient(client);

    const router = createMemoryRouter(webRoutes, {
      initialEntries: ['/'],
    });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Graph Foundations')).toBeInTheDocument();

    await user.type(screen.getByLabelText('web.import.identifierValue'), '2401.01234');
    await user.click(screen.getByRole('button', { name: 'web.import.submit' }));

    await waitFor(() => {
      expect(spies.importByIdentifier).toHaveBeenCalledWith({ value: '2401.01234', kind: 'arxiv' });
    });

    expect(
      await screen.findByRole('heading', { name: 'Imported Planning Paper' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'web.import.openReader' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/paper-2/reader');
    });
  });
});
