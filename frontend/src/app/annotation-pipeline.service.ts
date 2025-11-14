import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AnnotationPipelineService {
  private readonly savePipelineUrl = `${environment.apiPath}/user_pipeline`;

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

  public savePipeline(name: string, config: string): Observable<string> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    const formData = new FormData();
    const configFile = new File([config], 'config.yml');
    formData.append('name', name);
    formData.append('config', configFile);

    return this.http.post(
      this.savePipelineUrl,
      formData,
      options
    ).pipe(
      map((response: object) => response['name'] as string)
    );
  }
}
