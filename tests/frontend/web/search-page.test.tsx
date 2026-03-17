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

describe('web search page', () => {
  it('runs a browser search and opens a reader result', async () => {
    const resultPaper = createPaperSummary({
      id: 'paper-3',
      title: 'Search Result Paper',
      shortId: '2503.00003',
    });
    const { client, spies } = createMockClient({ searchResults: [resultPaper] });
    setResearchClawClient(client);

    const router = createMemoryRouter(webRoutes, {
      initialEntries: ['/search'],
    });

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.type(screen.getByLabelText('web.search.queryLabel'), 'transformer');
    await user.click(screen.getByRole('button', { name: 'web.search.searchAction' }));

    await waitFor(() => {
      expect(spies.search).toHaveBeenCalledWith({ query: 'transformer', limit: 20, mode: 'text' });
    });

    const resultLink = await screen.findByRole('link', { name: /Search Result Paper/ });
    await user.click(resultLink);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/paper-3/reader');
    });
  });
});
