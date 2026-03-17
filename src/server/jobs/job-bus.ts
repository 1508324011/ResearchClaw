import { EventEmitter } from 'node:events';
import {
  JobStatusSchema,
  JobStreamEventSchema,
  type JobStatus,
  type JobStreamEvent,
} from '@shared';

type JobEventListener = (event: JobStreamEvent) => void;

function sortByUpdatedAtDesc(left: JobStatus, right: JobStatus): number {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export class JobBus {
  private emitter = new EventEmitter();

  private jobs = new Map<string, JobStatus>();

  publish(event: JobStreamEvent): JobStreamEvent {
    const normalizedEvent = JobStreamEventSchema.parse(event);
    this.jobs.set(normalizedEvent.job.jobId, JobStatusSchema.parse(normalizedEvent.job));
    this.emitter.emit('event', normalizedEvent);
    return normalizedEvent;
  }

  list(): JobStatus[] {
    return Array.from(this.jobs.values()).sort(sortByUpdatedAtDesc);
  }

  get(jobId: string): JobStatus | null {
    return this.jobs.get(jobId) ?? null;
  }

  subscribe(listener: JobEventListener): () => void {
    this.emitter.on('event', listener);
    return () => {
      this.emitter.off('event', listener);
    };
  }

  reset(): void {
    this.jobs.clear();
    this.emitter.removeAllListeners('event');
  }
}

export const jobBus = new JobBus();
