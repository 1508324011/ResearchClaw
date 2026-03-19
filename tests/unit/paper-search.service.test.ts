import { afterEach, describe, expect, it, vi } from 'vitest';

const proxyFetch = vi.fn();

vi.mock('../../src/main/services/proxy-fetch', () => ({
  proxyFetch,
}));

describe('paper search service', () => {
  afterEach(() => {
    proxyFetch.mockReset();
    vi.resetModules();
  });

  it('normalizes external search results to the shared contract shape', async () => {
    proxyFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: {},
      body: Buffer.from(''),
      text: () =>
        JSON.stringify({
          total: 1,
          data: [
            {
              paperId: 'paper-123',
              title: 'Graph Neural Networks',
              authors: [
                { name: 'Ada Lovelace', authorId: '111' },
                { name: 'Grace Hopper', authorId: '222' },
              ],
              year: 2024,
              abstract: 'A survey of graph neural networks.',
              citationCount: 42,
              externalIds: {
                DOI: '10.1000/example',
                ArXiv: '2401.12345',
                CorpusId: '99999',
              },
              url: 'https://example.com/paper-123',
            },
          ],
        }),
    });

    const { searchPapers } = await import('../../src/main/services/paper-search.service');

    await expect(searchPapers('graph neural networks', 5)).resolves.toEqual({
      total: 1,
      results: [
        {
          paperId: 'paper-123',
          title: 'Graph Neural Networks',
          authors: [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }],
          year: 2024,
          abstract: 'A survey of graph neural networks.',
          citationCount: 42,
          externalIds: {
            DOI: '10.1000/example',
            ArXiv: '2401.12345',
          },
          url: 'https://example.com/paper-123',
        },
      ],
    });
  });
});
