import { Injectable } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { SingleAnnotationReport, Variant } from './single-annotation';


@Injectable()
export class SingleAnnotationService {
  private readonly getReportUrl = `${environment.apiPath}/single-annotation`;
  private readonly getGenomesUrl = `${environment.apiPath}/genomes`;
  public constructor(private http: HttpClient) { }

  public getReport(variant: Variant, genome: string): Observable<SingleAnnotationReport> {
    const options = { withCredentials: true };
    const variantJson = {
      chrom: variant.chromosome,
      pos: variant.position,
      ref: variant.reference,
      alt: variant.alernative
    };
    return this.http.post<object>(
      this.getReportUrl,
      { variant: variantJson, genome: genome },
      options
    ).pipe(map((response: object) => SingleAnnotationReport.fromJson(response)));
  }

  public getGenomes(): Observable<string[]> {
    return of(['hg38', 'hg19']);
  }
}
