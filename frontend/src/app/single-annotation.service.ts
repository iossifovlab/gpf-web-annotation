import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { CategoricalHistogram, NumberHistogram, SingleAnnotationReport, Variant } from './single-annotation';


@Injectable()
export class SingleAnnotationService {
  private readonly getReportUrl = `${environment.apiPath}/single_annotate`;
  private readonly getGenomesUrl = `${environment.apiPath}/genomes`;
  private readonly getHistogramUrl = `${environment.apiPath}`;
  public constructor(private http: HttpClient) { }

  public getReport(variant: Variant, genome: string): Observable<SingleAnnotationReport> {
    const variantJson = {
      chrom: variant.chromosome,
      pos: variant.position,
      ref: variant.reference,
      alt: variant.alernative
    };
    return this.http.post<object>(
      this.getReportUrl,
      { variant: variantJson, genome: genome },
    ).pipe(map((response: object) => SingleAnnotationReport.fromJson(response)));
  }

  public getHistogram(histogramUrl: string): Observable<NumberHistogram | CategoricalHistogram> {
    return this.http.get<object>(
      `${this.getHistogramUrl}/${histogramUrl}`,
    ).pipe(map((response: object) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return response['config']['type'] === 'number' ?
        NumberHistogram.fromJson(response) : CategoricalHistogram.fromJson(response);
    }));
  }

  public getGenomes(): Observable<string[]> {
    return this.http.get<string[]>(this.getGenomesUrl);
  }
}
