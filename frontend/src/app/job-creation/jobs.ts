export class Job {
  public constructor(
    public id: number,
    public created: Date,
    public owner: string,
    public status: Status,
    // public started: string,
    // public duration: string,
    // public inputFile: string,
    // public annotatedFile: string
  ) {}

  public static fromJsonArray(jsonArray: object[]): Job[] {
    if (!jsonArray) {
      return undefined;
    }
    return jsonArray.map((json) => Job.fromJson(json));
  }

  public static fromJson(json: object): Job {
    if (!json) {
      return undefined;
    }

    let status: Status = null;
    switch (json['status']) {
      case 1: status = 'specifying'; break;
      case 2: status = 'waiting'; break;
      case 3: status = 'in process'; break;
      case 4: status = 'success'; break;
      case 5: status = 'failed'; break;
    }

    return new Job(
      json['id'] as number,
      new Date(json['created'] as string),
      json['owner'] as string,
      status,
    );
  }
}

export type JobCreationView = 'text editor' | 'pipeline list';
export type Status = 'specifying' | 'waiting' | 'in process' | 'success' | 'failed';

export function getStatusClassName(status: string): string {
  switch (status) {
    case 'specifying': return 'specifying-status';
    case 'waiting': return 'waiting-status';
    case 'in process': return 'in-progress-status';
    case 'success': return 'success-status';
    case 'failed': return 'fail-status';
  }
  return '';
}

export class FileContent {
  public constructor(
    public jobId: number,
    public columns: string[],
    public rows: string[][]
  ) {}

  public static fromJson(json: object): FileContent {
    if (!json) {
      return undefined;
    }

    return new FileContent(
      json['id'] as number,
      json['columns'] as string[],
      toMatrix(json['head'] as object[]),
    );
  }
}

function toMatrix(rows: object[]): string[][] {
  const matrix: string[][] = [];

  rows.forEach((r: object) => {
    matrix.push(Object.values(r).map(c => getValueAsString(c)));
  });

  return matrix;
}

function getValueAsString(value: string | number): string {
  if (!value) {
    return '-';
  }
  if (typeof value === 'string') {
    return value;
  }
  return value.toString();
}