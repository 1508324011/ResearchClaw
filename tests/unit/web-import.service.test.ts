import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PapersService } from '../../src/main/services/papers.service';
import { WebImportError, WebImportService } from '../../src/server/services/web-import.service';

const realFetch = globalThis.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = realFetch;
});

describe('WebImportService DOI strict import', () => {
  it('does not create a paper before DOI document acquisition succeeds', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'paper-1' });
    const downloadPdf = vi.fn().mockRejectedValue(new Error('download failed'));
    const getById = vi.fn();
    const deleteById = vi.fn().mockResolvedValue(null);

    const service = new WebImportService();
    Object.defineProperty(service, 'papersService', {
      value: {
        create,
        downloadPdf,
        getById,
        deleteById,
      } satisfies Pick<PapersService, 'create' | 'downloadPdf' | 'getById' | 'deleteById'>,
    });

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const acceptHeader = new Headers(init?.headers).get('accept');

      if (url === 'https://doi.org/10.1000/test-doi') {
        if (acceptHeader?.includes('application/vnd.citationstyles.csl+json')) {
          return new Response(
            JSON.stringify({
              title: 'Retrieval-Augmented Planning via DOI',
              author: [{ given: 'Ada', family: 'Lovelace' }],
              abstract: 'A planning paper discovered through DOI metadata.',
              issued: { 'date-parts': [[2024, 3, 14]] },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/vnd.citationstyles.csl+json' },
            },
          );
        }

        return new Response(
          `<!doctype html><html><head><meta name="citation_title" content="Retrieval-Augmented Planning via DOI"><meta name="citation_author" content="Ada Lovelace"><meta name="citation_abstract" content="A planning paper discovered through DOI metadata."><meta name="citation_pdf_url" content="https://publisher.example/test-doi.pdf"></head><body></body></html>`,
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        );
      }

      if (url === 'https://publisher.example/test-doi.pdf') {
        return new Response('missing pdf', { status: 404 });
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const importPromise = service.importByIdentifier({ value: '10.1000/test-doi', kind: 'doi' });

    await expect(importPromise).rejects.toThrow(WebImportError);
    await expect(importPromise).rejects.toThrow('Unable to import DOI as a complete paper.');

    expect(create).not.toHaveBeenCalled();
    expect(deleteById).not.toHaveBeenCalled();
  });
});
