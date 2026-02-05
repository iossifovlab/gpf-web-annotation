import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PipelineEditorService {
  private getAnnotatorsUrl = `${environment.apiPath}/editor/annotator_types`;

  public constructor(private http: HttpClient) { }

  public getAnnotators(): Observable<string[]> {
    return this.http.get<string[]>(this.getAnnotatorsUrl);
  }
}
