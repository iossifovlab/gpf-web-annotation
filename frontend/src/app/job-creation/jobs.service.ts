import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class JobsService {
  private readonly createJobUrl = 'http://localhost:8000/jobs/create/';

  public constructor(
    private http: HttpClient,
  ) { }

  public createJob(file: File): Observable<object> {
    const options = { withCredentials: true };
    const formData = new FormData();
    formData.append('data', file, file.name);
    formData.append('config', new Blob(['absdb']), 'asd');
    return this.http.post(
      this.createJobUrl,
      formData,
      options
    );
  }
}
