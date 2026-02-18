import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { AnnotatorAttribute, AnnotatorConfig } from './new-annotator/annotator';

@Injectable({
  providedIn: 'root',
})
export class PipelineEditorService {
  private getAnnotatorsUrl = `${environment.apiPath}/editor/annotator_types`;
  private getAnnotatorConfigUrl = `${environment.apiPath}/editor/annotator_config`;
  private getResourcesUrl = `${environment.apiPath}/resources`;
  private getAttributesUrl = `${environment.apiPath}/editor/annotator_attributes`;
  private getAnnotatorYmlUrl = `${environment.apiPath}/editor/annotator_yaml`;

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
      switchMap(config => {
        const resourceObservables = config.resources.filter(r => r.fieldType === 'resource')
          .map(r =>
            this.getResources(r.resourceType).pipe(
              tap(values => {
                r.possibleValues = values;
              })
            )
          );

        if (resourceObservables.length === 0) {
          return of(config);
        }

        return forkJoin(resourceObservables).pipe(map(() => config));
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

  public getAnnotatorYml(
    annotatorType: string,
    resources: object,
    attributes: AnnotatorAttribute[]
  ): Observable<string> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };

    const extractedAttributes = attributes.map(({ name, source, internal }) => ({
      name: name,
      source: source,
      internal: internal
    }));

    const body = {
      // eslint-disable-next-line camelcase
      attributes: extractedAttributes,
      // eslint-disable-next-line camelcase
      annotator_type: annotatorType,
    };
    return this.http.post<string>(
      this.getAnnotatorYmlUrl,
      Object.assign(body, resources),
      options
    );
  }
}
