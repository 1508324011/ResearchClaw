import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '../../support/render-utils';
import {
  clearResearchClawClient,
  setResearchClawClient,
} from '../../../src/renderer/hooks/use-ipc';
import { ImportModal } from '../../../src/renderer/components/import-modal';
import { createMockClient, createPaperSummary } from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  clearResearchClawClient();
});

describe('browser import modal', () => {
  it('uploads PDF files through the browser host without Electron file dialogs', async () => {
    window.electronAPI = undefined;

    const importedPaper = createPaperSummary({
      id: 'paper-12',
      shortId: '2503.00012',
      title: 'Browser Uploaded PDF',
    });
    const { client, spies } = createMockClient({ importedPaper });
    setResearchClawClient(client);

    const onImported = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    const pdfFile = new File(['%PDF-1.4 browser upload'], 'browser-upload.pdf', {
      type: 'application/pdf',
    });

    render(<ImportModal onClose={onClose} onImported={onImported} />);

    await user.click(screen.getByRole('button', { name: 'Local' }));
    await user.upload(screen.getByLabelText('Choose PDF files'), pdfFile);
    await user.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(spies.importPdf).toHaveBeenCalledWith(pdfFile);
    });

    await waitFor(() => {
      expect(onImported).toHaveBeenCalled();
    });

    expect(await screen.findByText('Import complete')).toBeInTheDocument();
    expect(screen.getByText(/1 PDF imported successfully/i)).toBeInTheDocument();
  });
});
