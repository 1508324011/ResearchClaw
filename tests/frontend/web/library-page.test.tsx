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
  it('lists papers and imports a new paper into the browser flow', async () => {
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

    await user.type(screen.getByLabelText('web.library.importLabel'), '2401.01234');
    await user.click(screen.getByRole('button', { name: 'web.library.importAction' }));

    await waitFor(() => {
      expect(spies.importByIdentifier).toHaveBeenCalledWith({ value: '2401.01234', kind: 'arxiv' });
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/paper-2/reader');
    });
  });
});
