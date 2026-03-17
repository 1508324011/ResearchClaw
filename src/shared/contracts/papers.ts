import { z } from 'zod';

export const ImportedWithinSchema = z.enum(['today', 'week', 'month', 'all']);

export const IdentifierKindSchema = z.enum(['arxiv', 'doi', 'url']);

export const PaperSummarySchema = z
  .object({
    id: z.string().min(1),
    shortId: z.string().min(1).nullable().optional(),
    title: z.string().min(1),
    authors: z.array(z.string()).default([]),
    year: z.number().int().min(1900).max(2100).optional(),
    abstract: z.string().optional(),
    tagNames: z.array(z.string()).optional(),
    sourceUrl: z.string().url().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const ListPapersRequestSchema = z
  .object({
    q: z.string().optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    tag: z.string().optional(),
    importedWithin: ImportedWithinSchema.optional(),
  })
  .strict();

export const ListPapersResponseSchema = z
  .object({
    items: z.array(PaperSummarySchema),
    total: z.number().int().min(0),
  })
  .strict();

export const ImportByIdentifierRequestSchema = z
  .object({
    value: z.string().min(1),
    kind: IdentifierKindSchema,
  })
  .strict();

export const ImportPaperResponseSchema = z
  .object({
    paper: PaperSummarySchema,
    jobId: z.string().min(1).optional(),
  })
  .strict();

export type ImportedWithin = z.infer<typeof ImportedWithinSchema>;
export type IdentifierKind = z.infer<typeof IdentifierKindSchema>;
export type PaperSummary = z.infer<typeof PaperSummarySchema>;
export type ListPapersRequest = z.infer<typeof ListPapersRequestSchema>;
export type ListPapersResponse = z.infer<typeof ListPapersResponseSchema>;
export type ImportByIdentifierRequest = z.infer<typeof ImportByIdentifierRequestSchema>;
export type ImportPaperResponse = z.infer<typeof ImportPaperResponseSchema>;
