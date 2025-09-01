import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Job } from './jobs';
import { Pipeline } from './pipelines';

@Injectable()
export class JobsService {
  private readonly createJobUrl = 'http://localhost:8000/jobs/create/';
  private readonly getUsersJobsUrl = 'http://localhost:8000/jobs/';
  private readonly getPipelinesUrl = 'http://localhost:8000/pipelines/';

  public constructor(private http: HttpClient) { }

  private getCSRFToken(): string {
    let res = '';
    const value = `; ${document.cookie}`;
    const parts = value.split('; csrftoken=');
    if (parts.length === 2) {
      res = parts.pop().split(';').shift();
    }
    return res;
  }

  public createJob(file: File, pipeline: string, config: string): Observable<object> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    const formData = new FormData();
    formData.append('data', file, file.name);
    if (pipeline) {
      formData.append('pipeline', pipeline);
    } else {
      const configFile = new File([config], 'config.yml');
      formData.append('config', configFile);
    }
    return this.http.post(
      this.createJobUrl,
      formData,
      options
    );
  }

  public getJobs(): Observable<Job[]> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.get<object[]>(
      this.getUsersJobsUrl,
      options
    ).pipe(map((response: object[]) => Job.fromJsonArray(response)));
  }

  public getJobDetails(jobId: number): Observable<Job> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.get(
      this.getUsersJobsUrl + jobId,
      options
    ).pipe(map((response: object) => Job.fromJson(response)));
  }

  public getDownloadJobResultLink(jobId: number): string {
    return `http://localhost:8000/jobs/${jobId}/file/result/`;
  }

  public getJobInputDownloadLink(jobId: number): string {
    return `http://localhost:8000/jobs/${jobId}/file/input/`;
  }

  public getJobConfigLink(jobId: number): string {
    return `http://localhost:8000/jobs/${jobId}/file/config/`;
  }

  public getAnnotationPipelines(): Observable<Pipeline[]> {
    return this.http.get<Pipeline[]>(
      this.getPipelinesUrl,
      { withCredentials: true }
    );
  }
}
