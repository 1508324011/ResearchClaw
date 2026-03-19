import { z } from 'zod';

import { PaperSummarySchema } from './papers';

export const ReadingNoteContentSchema = z.record(z.string(), z.unknown());

export const ReadingNoteSchema = z
  .object({
    id: z.string().min(1),
    paperId: z.string().min(1),
    title: z.string().min(1),
    content: ReadingNoteContentSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const GetReadingDetailRequestSchema = z
  .object({
    paperId: z.string().min(1),
  })
  .strict();

export const GetReadingDetailResponseSchema = z
  .object({
    paper: PaperSummarySchema,
    note: ReadingNoteSchema.nullable(),
    pdfUrl: z.string().min(1).optional(),
  })
  .strict();

export const SaveReadingNoteRequestSchema = z
  .object({
    paperId: z.string().min(1),
    noteId: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    content: ReadingNoteContentSchema,
  })
  .strict();

export const SaveReadingNoteResponseSchema = z
  .object({
    note: ReadingNoteSchema,
  })
  .strict();

export type ReadingNoteContent = z.infer<typeof ReadingNoteContentSchema>;
export type ReadingNote = z.infer<typeof ReadingNoteSchema>;
export type GetReadingDetailRequest = z.infer<typeof GetReadingDetailRequestSchema>;
export type GetReadingDetailResponse = z.infer<typeof GetReadingDetailResponseSchema>;
export type SaveReadingNoteRequest = z.infer<typeof SaveReadingNoteRequestSchema>;
export type SaveReadingNoteResponse = z.infer<typeof SaveReadingNoteResponseSchema>;
