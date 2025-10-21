import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { FileContent, Job } from './jobs';
import { Pipeline } from './pipelines';
import { environment } from '../../../environments/environment';

@Injectable()
export class JobsService {
  private readonly createJobUrl = `${environment.apiPath}/jobs/create`;
  private readonly validateJobConfigUrl = `${environment.apiPath}/jobs/validate`;
  private readonly jobsUrl = `${environment.apiPath}/jobs`;
  private readonly getPipelinesUrl = `${environment.apiPath}/pipelines`;

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
    ).pipe(
      map((response: object) => response ? FileContent.fromJson(response) : response),
      catchError((err: HttpErrorResponse) => {
        switch (err.status) {
          case 403: return throwError(() => new Error((err.error as {reason: string})['reason']));
          case 413: return throwError(() => new Error('Upload limit reached!'));
          case 400: return throwError(() => new Error((err.error as {reason: string})['reason']));
          default: return throwError(() => new Error('Error occurred!'));
        }
      })
    );
  }

  public getJobs(): Observable<Job[]> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.get<object[]>(
      this.jobsUrl,
      options
    ).pipe(map((response: object[]) => Job.fromJsonArray(response)));
  }

  public getJobDetails(jobId: number): Observable<Job> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.get(
      this.jobsUrl + '/' + jobId,
      options
    ).pipe(map((response: object) => Job.fromJson(response)));
  }

  public validateJobConfig(config: string): Observable<string> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };

    return this.http.post(
      this.validateJobConfigUrl,
      {config: config},
      options
    ).pipe(
      map((response: object) => {
        return response['errors'] as string;
      }),
    );
  }

  public getDownloadJobResultLink(jobId: number): string {
    return `${environment.apiPath}/jobs/${jobId}/file/result`;
  }

  public getJobInputDownloadLink(jobId: number): string {
    return `${environment.apiPath}/jobs/${jobId}/file/input`;
  }

  public getJobConfigLink(jobId: number): string {
    return `${environment.apiPath}/jobs/${jobId}/file/config`;
  }

  public getAnnotationPipelines(): Observable<Pipeline[]> {
    return this.http.get<object[]>(
      this.getPipelinesUrl,
      { withCredentials: true }
    ).pipe(map((response: object[]) => Pipeline.fromJsonArray(response)));
  }

  public deleteJob(jobId: number): Observable<object> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.delete(
      `${this.jobsUrl}/${jobId}`,
      options
    );
  }

  public specifyColumns(jobId: number, columns: Map<string, string>): Observable<object> {
    const options = {
      headers: {
        'X-CSRFToken': this.getCSRFToken(),
        'Content-Type': 'application/json'
      },
      withCredentials: true
    };

    return this.http.post(
      `${this.jobsUrl}/${jobId}/specify`,
      /* eslint-disable camelcase */
      {
        col_chrom: columns.get('chrom'),
        col_pos: columns.get('pos'),
        col_ref: columns.get('ref'),
        col_alt: columns.get('alt'),
      },
      /* eslint-enable */
      options
    ).pipe(
      catchError((err: HttpErrorResponse) => {
        switch (err.status) {
          case 403: return throwError(() => new Error('Quota reached!'));
          case 404: return throwError(() => new Error('Job not found!'));
          case 400: return throwError(() => new Error((err.error as {reason: string})['reason']));
          default: return throwError(() => new Error('Error occurred!'));
        }
      })
    );
  }
}
