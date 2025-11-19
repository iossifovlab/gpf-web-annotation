export class Job {
  public constructor(
    public id: number,
    public name: number,
    public created: Date,
    public owner: string,
    public status: Status,
    public duration: number,
    public annotatedFileName: string,
    public size: string,
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
      case 1: status = 'waiting'; break;
      case 2: status = 'in process'; break;
      case 3: status = 'success'; break;
      case 4: status = 'failed'; break;
    }

    return new Job(
      json['id'] as number,
      json['name'] as number,
      new Date(json['created'] as string),
      json['owner'] as string,
      status,
      json['duration'] as number,
      json['result_filename'] as string,
      json['size'] as string,
    );
  }
}

export type Status = 'waiting' | 'in process' | 'success' | 'failed';

export function getStatusClassName(status: string): string {
  switch (status) {
    case 'waiting': return 'waiting-status';
    case 'in process': return 'in-progress-status';
    case 'success': return 'success-status';
    case 'failed': return 'fail-status';
  }
  return '';
}

export class FileContent {
  public constructor(
    public separator: string,
    public columns: string[],
    public rows: string[][]
  ) {}

  public static fromJson(json: object): FileContent {
    if (!json) {
      return undefined;
    }

    return new FileContent(
      json['separator'] as string,
      json['columns'] as string[],
      toMatrix(json['preview'] as object[]),
    );
  }
}

function toMatrix(rows: object[]): string[][] {
  const matrix: string[][] = [];

  rows.forEach((r: object) => {
    matrix.push(Object.values(r).map((c: string | number) => getValueAsString(c)));
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