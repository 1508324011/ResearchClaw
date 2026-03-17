import { z } from 'zod';

export const JobKindSchema = z.enum(['import', 'analysis']);

export const JobStateSchema = z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']);

export const JobStatusSchema = z
  .object({
    jobId: z.string().min(1),
    kind: JobKindSchema,
    state: JobStateSchema,
    message: z.string().min(1).optional(),
    progress: z.number().min(0).max(100).optional(),
    startedAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime(),
  })
  .strict();

const ProgressJobStreamEventSchema = z
  .object({
    type: z.literal('progress'),
    job: JobStatusSchema,
  })
  .strict();

const DoneJobStreamEventSchema = z
  .object({
    type: z.literal('done'),
    job: JobStatusSchema,
  })
  .strict();

const SnapshotJobStreamEventSchema = z
  .object({
    type: z.literal('snapshot'),
    job: JobStatusSchema,
  })
  .strict();

const ErrorJobStreamEventSchema = z
  .object({
    type: z.literal('error'),
    job: JobStatusSchema,
    error: z.string().min(1).optional(),
  })
  .strict();

export const JobStreamEventSchema = z.discriminatedUnion('type', [
  ProgressJobStreamEventSchema,
  DoneJobStreamEventSchema,
  SnapshotJobStreamEventSchema,
  ErrorJobStreamEventSchema,
]);

export type JobKind = z.infer<typeof JobKindSchema>;
export type JobState = z.infer<typeof JobStateSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobStreamEvent = z.infer<typeof JobStreamEventSchema>;
