import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { AnnotatorAttribute, AnnotatorConfig } from './new-annotator/annotator';

@Injectable({
  providedIn: 'root',
})
export class PipelineEditorService {
  private getAnnotatorsUrl = `${environment.apiPath}/editor/annotator_types`;
  private getAnnotatorConfigUrl = `${environment.apiPath}/editor/annotator_config`;
  private getResourcesUrl = `${environment.apiPath}/resources`;
  private getAttributesUrl = `${environment.apiPath}/editor/annotator_attributes`;

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

  public getAnnotators(): Observable<string[]> {
    return this.http.get<string[]>(this.getAnnotatorsUrl);
  }

  public getAnnotatorConfig(annotator: string): Observable<AnnotatorConfig> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.post(
      this.getAnnotatorConfigUrl,
      // eslint-disable-next-line camelcase
      { annotator_type: annotator },
      options
    ).pipe(
      map((response: object) => AnnotatorConfig.fromJson(response)),
      map(config => {
        config.resources.forEach(r => {
          if (r.fieldType === 'resource') {
            this.getResources(r.resourceType).subscribe(v => r.possibleValues = v);
          }
        });
        return config;
      })
    );
  }


  public getResources(annotatorType: string): Observable<string[]> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.get<string[]>(
      `${this.getResourcesUrl}?type=${annotatorType}`,
      options
    );
  }

  public getAttributes(
    pipelineId: string,
    annotatorType: string,
    resources: object
  ): Observable<AnnotatorAttribute[]> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };

    const body = {
      // eslint-disable-next-line camelcase
      pipeline_id: pipelineId,
      // eslint-disable-next-line camelcase
      annotator_type: annotatorType,
    };

    return this.http.post<AnnotatorAttribute[]>(
      this.getAttributesUrl,
      Object.assign(body, resources),
      options
    ).pipe(map((response: object[]) => AnnotatorAttribute.fromJsonArray(response)));
  }
}
