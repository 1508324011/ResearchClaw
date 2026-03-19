import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import {
  clearResearchClawClient,
  setResearchClawClient,
} from '../../../src/renderer/hooks/use-ipc';
import { createMockClient, createWebTestRouter } from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  clearResearchClawClient();
});

describe('renderer shell parity', () => {
  it('boots the browser runtime through the canonical renderer shell instead of the custom web layout', async () => {
    window.electronAPI = undefined;

    const { client } = createMockClient();
    setResearchClawClient(client);

    const router = createWebTestRouter(['/']);

    render(<RouterProvider router={router} />);

    expect(await screen.findByTestId('app-shell-root')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'app-sidebar' })).toBeInTheDocument();
    expect(screen.queryByText('ResearchClaw Web')).not.toBeInTheDocument();
  });
});
