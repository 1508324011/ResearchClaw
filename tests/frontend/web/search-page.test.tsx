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

describe('web search page', () => {
  it('uses canonical search UI and opens results through shortId routes', async () => {
    const resultPaper = createPaperSummary({
      id: 'paper-3',
      title: 'Transformer Search Result',
      shortId: '2503.00003',
    });
    const { client, spies } = createMockClient({
      papers: [resultPaper],
      importedPaper: resultPaper,
    });
    setResearchClawClient(client);

    const router = createWebTestRouter(['/search']);

    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    const input = screen.getByPlaceholderText('Search by title, tag, abstract, or meaning…');
    expect(input).toBeInTheDocument();

    await waitFor(() => {
      expect(spies.listPapers).toHaveBeenCalled();
    });

    await user.type(input, 'transformer{Enter}');

    const resultTitle = await screen.findByText('Transformer Search Result');
    await user.click(resultTitle.closest('button') as HTMLButtonElement);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers/2503.00003');
    });
  });
});
