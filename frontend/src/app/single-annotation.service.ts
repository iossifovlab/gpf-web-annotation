import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { SingleAnnotationReport } from './single-annotation';

@Injectable()
export class SingleAnnotationService {
  private readonly getReportUrl = `${environment.apiPath}`;
  private readonly getGenomesUrl = `${environment.apiPath}/genomes`;
  public constructor(private http: HttpClient) { }

  public getReport(): Observable<SingleAnnotationReport> {
    const options = { withCredentials: true };
    return this.http.get<object>(
      this.getReportUrl,
      options
    ).pipe(map((response: object) => SingleAnnotationReport.fromJson(response)));
  }

  public getGenomes(): Observable<string[]> {
    return of(['hg38', 'hg19']);
  }
}
