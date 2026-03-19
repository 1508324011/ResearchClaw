import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';
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

describe('canonical route handoff', () => {
  it('hands the browser root route off to canonical /papers instead of treating / as a custom library page', async () => {
    window.electronAPI = undefined;

    const { client } = createMockClient();
    setResearchClawClient(client);

    const router = createWebTestRouter(['/']);

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/papers');
    });
  });
});
