import { z } from 'zod';

export const ExternalPaperSearchRequestSchema = z
  .object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const ExternalPaperSearchResultItemSchema = z
  .object({
    paperId: z.string().min(1),
    title: z.string().min(1),
    authors: z.array(
      z
        .object({
          name: z.string().min(1),
        })
        .strict(),
    ),
    year: z.number().int().nullable(),
    abstract: z.string().nullable(),
    citationCount: z.number().int().min(0),
    externalIds: z
      .object({
        ArXiv: z.string().optional(),
        DOI: z.string().optional(),
      })
      .strict(),
    url: z.string().nullable(),
  })
  .strict();

export const ExternalPaperSearchResponseSchema = z
  .object({
    results: z.array(ExternalPaperSearchResultItemSchema),
    total: z.number().int().min(0),
  })
  .strict();

export type ExternalPaperSearchRequest = z.infer<typeof ExternalPaperSearchRequestSchema>;
export type ExternalPaperSearchResultItem = z.infer<typeof ExternalPaperSearchResultItemSchema>;
export type ExternalPaperSearchResponse = z.infer<typeof ExternalPaperSearchResponseSchema>;
