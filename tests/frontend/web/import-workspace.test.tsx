import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { userEvent } from '../../support/render-utils';
import { ImportWorkspace } from '../../../src/web/components/import-workspace';
import { createMockClient, createPaperSummary } from './test-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('web import workspace', () => {
  it('submits identifier imports with an explicit kind and exposes browser handoff links', async () => {
    const importedPaper = createPaperSummary({
      id: 'paper-2',
      shortId: 'doi-paper',
      title: 'DOI Workflow Paper',
    });
    const { client, spies } = createMockClient({ importedPaper });
    const onImported = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ImportWorkspace client={client} onImported={onImported} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('web.import.identifierKind'), 'doi');
    await user.type(screen.getByLabelText('web.import.identifierValue'), '10.1000/example-doi');
    await user.click(screen.getByRole('button', { name: 'web.import.submit' }));

    await waitFor(() => {
      expect(spies.importByIdentifier).toHaveBeenCalledWith({
        kind: 'doi',
        value: '10.1000/example-doi',
      });
    });

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith(importedPaper);
    });

    expect(await screen.findByRole('link', { name: 'web.import.openReader' })).toHaveAttribute(
      'href',
      '/papers/paper-2/reader',
    );
    expect(screen.getByRole('link', { name: 'web.import.openNotes' })).toHaveAttribute(
      'href',
      '/papers/paper-2/notes',
    );
  });

  it('uploads a PDF from the browser workspace', async () => {
    const importedPaper = createPaperSummary({
      id: 'paper-4',
      shortId: 'local-paper',
      title: 'Uploaded PDF Paper',
    });
    const { client, spies } = createMockClient({ importedPaper });
    const onImported = vi.fn();
    const user = userEvent.setup();
    const pdfFile = new File(['%PDF-1.4 sample'], 'sample.pdf', { type: 'application/pdf' });

    render(
      <MemoryRouter>
        <ImportWorkspace client={client} onImported={onImported} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'web.import.tabPdf' }));
    await user.upload(screen.getByLabelText('web.import.pdfInput'), pdfFile);
    expect(screen.getByText('sample.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'web.import.submit' }));

    await waitFor(() => {
      expect(spies.importPdf).toHaveBeenCalledWith(pdfFile);
    });

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith(importedPaper);
    });

    expect(await screen.findByRole('link', { name: 'web.import.openReader' })).toHaveAttribute(
      'href',
      '/papers/paper-4/reader',
    );
  });

  it('shows local import errors without clearing the form', async () => {
    const { client, spies } = createMockClient();
    const onImported = vi.fn();
    const user = userEvent.setup();
    spies.importByIdentifier.mockRejectedValueOnce(new Error('Identifier import failed'));

    render(
      <MemoryRouter>
        <ImportWorkspace client={client} onImported={onImported} />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText('web.import.identifierKind'), 'url');
    await user.type(
      screen.getByLabelText('web.import.identifierValue'),
      'https://example.com/paper',
    );
    await user.click(screen.getByRole('button', { name: 'web.import.submit' }));

    expect(await screen.findByText('Identifier import failed')).toBeInTheDocument();
    expect(screen.getByLabelText('web.import.identifierValue')).toHaveValue(
      'https://example.com/paper',
    );
    expect(onImported).not.toHaveBeenCalled();
  });
});
