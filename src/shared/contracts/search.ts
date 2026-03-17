import { z } from 'zod';

import { PaperSummarySchema } from './papers';

export const SearchModeSchema = z.enum(['text', 'semantic']);

export const SearchRequestSchema = z
  .object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional(),
    mode: SearchModeSchema.optional(),
  })
  .strict();

export const SearchResultItemSchema = PaperSummarySchema.extend({
  score: z.number().optional(),
  excerpt: z.string().optional(),
}).strict();

export const SearchResponseSchema = z
  .object({
    mode: SearchModeSchema,
    results: z.array(SearchResultItemSchema),
    total: z.number().int().min(0),
  })
  .strict();

export type SearchMode = z.infer<typeof SearchModeSchema>;
export type SearchRequest = z.infer<typeof SearchRequestSchema>;
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
