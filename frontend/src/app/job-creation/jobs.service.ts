import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { Job } from './jobs';

@Injectable()
export class JobsService {
  private readonly createJobUrl = 'http://localhost:8000/jobs/create/';
  private readonly getUsersJobsUrl = 'http://localhost:8000/jobs/';

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

  public createJob(file: File, config: string): Observable<object> {
    const configFile = new File([config], 'config.yml');
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    const formData = new FormData();
    formData.append('data', file, file.name);
    formData.append('config', configFile);
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
}