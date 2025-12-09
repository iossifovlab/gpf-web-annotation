import { JobStatus } from '../job-creation/jobs';

export class JobNotification {
  public constructor(
    public jobId: number,
    public status: JobStatus,
  ) {}

  public static fromJson(json: object): JobNotification {
    if (!json) {
      return undefined;
    }

    let status: JobStatus = null;
    switch (json['status']) {
      case 1: status = 'waiting'; break;
      case 2: status = 'in process'; break;
      case 3: status = 'success'; break;
      case 4: status = 'failed'; break;
    }

    return new JobNotification(
      json['job_id'] as number,
      status,
    );
  }
}

export type PipelineStatus = 'loaded' | 'loading' | 'unloaded';

export class PipelineNotification {
  public constructor(
    public pipelineId: number,
    public status: PipelineStatus,
  ) {}

  public static fromJson(json: object): PipelineNotification {
    if (!json) {
      return undefined;
    }

    return new PipelineNotification(
      json['pipeline_id'] as number,
      json['status'] as PipelineStatus,
    );
  }
}