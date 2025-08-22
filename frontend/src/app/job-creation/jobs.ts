export class Job {
  public constructor(
    public name: string,
    public created: string,
    public started: string,
    public duration: string,
    public owner: string,
    public inputFile: string,
    public annotatedFile: string
  ) {}
}

export type JobCreationView = 'text editor' | 'pipeline list';