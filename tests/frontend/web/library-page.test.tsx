import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '../../support/render-utils';
import {
  setResearchClawClient,
  clearResearchClawClient,
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

describe('web library page', () => {
  it('renders the canonical papers library instead of removed custom web actions', async () => {
    const paper = createPaperSummary({ title: 'Graph Foundations' });
    const { client } = createMockClient({ papers: [paper] });
    setResearchClawClient(client);

    const router = createWebTestRouter(['/']);

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Graph Foundations')).toBeInTheDocument();
    expect(screen.getByText('papersByTag.library')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Graph Foundations Ada Lovelace/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'web.library.openJobs' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('web.import.identifierValue')).not.toBeInTheDocument();
  });

  it('opens the canonical overview route with the paper shortId when selecting a paper card', async () => {
    const paper = createPaperSummary({
      id: 'paper-2',
      shortId: '2401.01234',
      title: 'Imported Planning Paper',
    });
    const { client } = createMockClient({
      papers: [paper],
      importedPaper: paper,
    });
    setResearchClawClient(client);

    const router = createWebTestRouter(['/']);

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(
      await screen.findByRole('button', { name: /Imported Planning Paper Ada Lovelace/ }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/2401.01234');
    });

    expect(
      await screen.findByRole('heading', { name: 'Imported Planning Paper' }),
    ).toBeInTheDocument();
  });
});
