import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { FileContent, Job } from './jobs';
import { Pipeline } from './pipelines';
import { environment } from '../../../environments/environment';

@Injectable()
export class JobsService {
  private readonly validateJobConfigUrl = `${environment.apiPath}/jobs/validate`;
  private readonly jobsUrl = `${environment.apiPath}/jobs`;
  private readonly jobPreviewUrl = `${environment.apiPath}/jobs/preview`;
  private readonly getPipelinesUrl = `${environment.apiPath}/pipelines`;
  private readonly annotateColumnsUrl = `${environment.apiPath}/jobs/annotate_columns`;
  private readonly annotateVcfUrl = `${environment.apiPath}/jobs/annotate_vcf`;

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

  public createVcfJob(
    file: File,
    pipeline: string,
    config: string,
    genome: string,
  ): Observable<object> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    const formData = new FormData();
    formData.append('data', file);
    formData.append('genome', genome);
    if (pipeline) {
      formData.append('pipeline', pipeline);
    } else {
      const configFile = new File([config], 'config.yml');
      formData.append('config', configFile);
    }
    return this.http.post(
      this.annotateVcfUrl,
      formData,
      options
    ).pipe(
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

  public createNonVcfJob(
    file: File,
    pipeline: string,
    config: string,
    genome: string,
    fileSeparator: string,
    columns: Map<string, string>
  ): Observable<object> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    const formData = new FormData();
    formData.append('data', file);
    formData.append('genome', genome);
    if (fileSeparator) {
      formData.append('separator', fileSeparator);
    }
    if (pipeline) {
      formData.append('pipeline', pipeline);
    } else {
      const configFile = new File([config], 'config.yml');
      formData.append('config', configFile);
    }

    if (columns.get('chrom')) {
      formData.append('col_chrom', columns.get('chrom'));
    }
    if (columns.get('pos')) {
      formData.append('col_pos', columns.get('pos'));
    }
    if (columns.get('ref')) {
      formData.append('col_ref', columns.get('ref'));
    }
    if (columns.get('alt')) {
      formData.append('col_alt', columns.get('alt'));
    }
    if (columns.get('position_begin')) {
      formData.append('col_pos_beg', columns.get('position_begin'));
    }
    if (columns.get('position_end')) {
      formData.append('col_pos_end', columns.get('position_end'));
    }
    if (columns.get('cnv_type')) {
      formData.append('col_cnv_type', columns.get('cnv_type'));
    }
    if (columns.get('vcf_like')) {
      formData.append('col_vcf_like', columns.get('vcf_like'));
    }
    if (columns.get('variant')) {
      formData.append('col_variant', columns.get('variant'));
    }
    if (columns.get('location')) {
      formData.append('col_location', columns.get('location'));
    }
    return this.http.post(
      this.annotateColumnsUrl,
      formData,
      options
    ).pipe(
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

  public submitFile(file: File) : Observable<FileContent> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    const formData = new FormData();
    formData.append('data', file);
    return this.http.post(
      this.jobPreviewUrl,
      formData,
      options
    ).pipe(
      map((response: object) => FileContent.fromJson(response))
    );
  }

  public submitSeparator(file: File, separator: string) : Observable<FileContent> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    const formData = new FormData();
    formData.append('data', file);
    formData.append('separator', separator);
    return this.http.post(
      this.jobPreviewUrl,
      formData,
      options
    ).pipe(
      map((response: object) => FileContent.fromJson(response))
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

  public getFileData(jobId: number): Observable<FileContent> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.get(
      this.jobsUrl + '/' + jobId,
      options
    ).pipe(map((response: object) => FileContent.fromJson({
      /* eslint-disable @typescript-eslint/no-unsafe-assignment */
      id: response['id'],
      columns: response['columns'],
      head: response['head']
      /* eslint-enable */
    })));
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
}
