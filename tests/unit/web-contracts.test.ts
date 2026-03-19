import { describe, expect, it } from 'vitest';

import {
  GetPaperDetailRequestSchema,
  GetPaperDetailResponseSchema,
  ImportedWithinSchema,
  ImportByIdentifierRequestSchema,
  ImportPaperResponseSchema,
  ListPapersRequestSchema,
  ListPapersResponseSchema,
  PaperSummarySchema,
} from '../../src/shared/contracts/papers';
import {
  JobKindSchema,
  JobStateSchema,
  JobStatusSchema,
  JobStreamEventSchema,
} from '../../src/shared/contracts/jobs';
import {
  GetReadingDetailRequestSchema,
  GetReadingDetailResponseSchema,
  ReadingNoteSchema,
  SaveReadingNoteRequestSchema,
  SaveReadingNoteResponseSchema,
} from '../../src/shared/contracts/reading';
import {
  SearchRequestSchema,
  SearchResponseSchema,
  SearchResultItemSchema,
} from '../../src/shared/contracts/search';

describe('web contract schemas', () => {
  describe('papers contracts', () => {
    it('accepts the shared importedWithin filter values', () => {
      expect(ImportedWithinSchema.parse('today')).toBe('today');
      expect(ImportedWithinSchema.parse('week')).toBe('week');
      expect(ImportedWithinSchema.parse('month')).toBe('month');
      expect(ImportedWithinSchema.parse('all')).toBe('all');
    });

    it('validates a browser-safe paper summary', () => {
      const result = PaperSummarySchema.safeParse({
        id: 'paper-1',
        shortId: '2503.00001',
        title: 'Attention Is Still Useful',
        authors: ['Alice', 'Bob'],
        year: 2025,
        abstract: 'A compact summary.',
        tagNames: ['nlp', 'transformers'],
        sourceUrl: 'https://arxiv.org/abs/2503.00001',
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T01:00:00.000Z',
      });

      expect(result.success).toBe(true);
    });

    it('rejects desktop-only file path fields in paper summaries', () => {
      const result = PaperSummarySchema.safeParse({
        id: 'paper-1',
        shortId: '2503.00001',
        title: 'Attention Is Still Useful',
        authors: ['Alice'],
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T01:00:00.000Z',
        pdfPath: '/Users/example/Downloads/paper.pdf',
      });

      expect(result.success).toBe(false);
    });

    it('validates paper list queries with existing repo filter conventions', () => {
      const result = ListPapersRequestSchema.safeParse({
        q: 'attention',
        year: 2025,
        tag: 'nlp',
        importedWithin: 'month',
      });

      expect(result.success).toBe(true);
    });

    it('validates identifier-based import requests without local file paths', () => {
      const result = ImportByIdentifierRequestSchema.safeParse({
        value: '10.1000/example-doi',
        kind: 'doi',
      });

      expect(result.success).toBe(true);
    });

    it('validates paper detail requests', () => {
      const result = GetPaperDetailRequestSchema.safeParse({ paperId: 'paper-1' });

      expect(result.success).toBe(true);
    });

    it('returns import responses as paper plus optional job id', () => {
      const result = ImportPaperResponseSchema.safeParse({
        paper: {
          id: 'paper-1',
          shortId: '2503.00001',
          title: 'Attention Is Still Useful',
          authors: ['Alice'],
          createdAt: '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T01:00:00.000Z',
        },
        jobId: 'job-import-1',
      });

      expect(result.success).toBe(true);
    });

    it('validates paper detail responses with an optional PDF asset link', () => {
      const result = GetPaperDetailResponseSchema.safeParse({
        paper: {
          id: 'paper-1',
          shortId: '2503.00001',
          title: 'Attention Is Still Useful',
          authors: ['Alice'],
          createdAt: '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T01:00:00.000Z',
        },
        pdfUrl: '/papers/paper-1/pdf',
      });

      expect(result.success).toBe(true);
    });

    it('validates the list response payload', () => {
      const result = ListPapersResponseSchema.safeParse({
        items: [
          {
            id: 'paper-1',
            shortId: '2503.00001',
            title: 'Attention Is Still Useful',
            authors: ['Alice'],
            createdAt: '2026-03-17T00:00:00.000Z',
            updatedAt: '2026-03-17T01:00:00.000Z',
          },
        ],
        total: 1,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('reading contracts', () => {
    it('validates reading detail requests', () => {
      const result = GetReadingDetailRequestSchema.safeParse({ paperId: 'paper-1' });
      expect(result.success).toBe(true);
    });

    it('validates structured reading notes', () => {
      const result = ReadingNoteSchema.safeParse({
        id: 'note-1',
        paperId: 'paper-1',
        title: 'Reading note',
        content: {
          Summary: 'A concise note.',
          Questions: ['What is the dataset?'],
        },
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T01:00:00.000Z',
      });

      expect(result.success).toBe(true);
    });

    it('validates reading detail responses with optional note', () => {
      const result = GetReadingDetailResponseSchema.safeParse({
        paper: {
          id: 'paper-1',
          shortId: '2503.00001',
          title: 'Attention Is Still Useful',
          authors: ['Alice'],
          createdAt: '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T01:00:00.000Z',
        },
        note: null,
        pdfUrl: '/papers/paper-1/pdf',
      });

      expect(result.success).toBe(true);
    });

    it('validates note-save requests', () => {
      const result = SaveReadingNoteRequestSchema.safeParse({
        paperId: 'paper-1',
        title: 'Reading note',
        content: {
          Summary: 'A concise note.',
        },
      });

      expect(result.success).toBe(true);
    });

    it('validates note-save responses', () => {
      const result = SaveReadingNoteResponseSchema.safeParse({
        note: {
          id: 'note-1',
          paperId: 'paper-1',
          title: 'Reading note',
          content: { Summary: 'A concise note.' },
          createdAt: '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T01:00:00.000Z',
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('search contracts', () => {
    it('validates search requests for text and semantic modes', () => {
      expect(
        SearchRequestSchema.safeParse({
          query: 'transformer',
          limit: 10,
          mode: 'text',
        }).success,
      ).toBe(true);

      expect(
        SearchRequestSchema.safeParse({
          query: 'transformer',
          limit: 10,
          mode: 'semantic',
        }).success,
      ).toBe(true);
    });

    it('validates search result items', () => {
      const result = SearchResultItemSchema.safeParse({
        id: 'paper-1',
        shortId: '2503.00001',
        title: 'Attention Is Still Useful',
        authors: ['Alice'],
        year: 2025,
        abstract: 'A compact summary.',
        tagNames: ['nlp'],
        sourceUrl: 'https://arxiv.org/abs/2503.00001',
        createdAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T01:00:00.000Z',
      });

      expect(result.success).toBe(true);
    });

    it('validates search responses', () => {
      const result = SearchResponseSchema.safeParse({
        mode: 'semantic',
        results: [
          {
            id: 'paper-1',
            shortId: '2503.00001',
            title: 'Attention Is Still Useful',
            authors: ['Alice'],
            createdAt: '2026-03-17T00:00:00.000Z',
            updatedAt: '2026-03-17T01:00:00.000Z',
          },
        ],
        total: 1,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('job contracts', () => {
    it('limits first-slice job kinds to import and analysis', () => {
      expect(JobKindSchema.parse('import')).toBe('import');
      expect(JobKindSchema.parse('analysis')).toBe('analysis');
      expect(JobKindSchema.safeParse('projects').success).toBe(false);
    });

    it('validates supported job states', () => {
      expect(JobStateSchema.parse('queued')).toBe('queued');
      expect(JobStateSchema.parse('running')).toBe('running');
      expect(JobStateSchema.parse('completed')).toBe('completed');
      expect(JobStateSchema.parse('failed')).toBe('failed');
      expect(JobStateSchema.parse('cancelled')).toBe('cancelled');
    });

    it('validates job status payloads', () => {
      const result = JobStatusSchema.safeParse({
        jobId: 'job-import-1',
        kind: 'import',
        state: 'running',
        message: 'Importing metadata',
        progress: 50,
        startedAt: '2026-03-17T00:00:00.000Z',
        updatedAt: '2026-03-17T00:00:10.000Z',
      });

      expect(result.success).toBe(true);
    });

    it('validates SSE-style job stream events', () => {
      const result = JobStreamEventSchema.safeParse({
        type: 'progress',
        job: {
          jobId: 'job-analysis-1',
          kind: 'analysis',
          state: 'running',
          message: 'Generating analysis',
          progress: 60,
          startedAt: '2026-03-17T00:00:00.000Z',
          updatedAt: '2026-03-17T00:00:10.000Z',
        },
      });

      expect(result.success).toBe(true);
    });
  });
});
