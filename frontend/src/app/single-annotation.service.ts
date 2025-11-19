import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Allele, CategoricalHistogram, NumberHistogram, SingleAnnotationReport, Variant } from './single-annotation';


@Injectable()
export class SingleAnnotationService {
  private readonly getReportUrl = `${environment.apiPath}/single_allele/annotate`;
  private readonly getGenomesUrl = `${environment.apiPath}/jobs/genomes`;
  private readonly allelesHistoryUrl = `${environment.apiPath}/single_allele/history`;
  private readonly getHistogramUrl = `${environment.apiPath}/single_allele`;
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

  public getReport(variant: Variant, pipeline: string): Observable<SingleAnnotationReport> {
    const variantJson = {
      chrom: variant.chromosome,
      pos: variant.position,
      ref: variant.reference,
      alt: variant.alernative
    };

    const userToken = this.getCSRFToken();
    const options = userToken ? { headers: {'X-CSRFToken': userToken}, withCredentials: true } : {};

    return this.http.post<object>(
      this.getReportUrl,
      { variant: variantJson, pipeline: pipeline },
      options
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

  public getAllelesHistory(): Observable<Allele[]> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.get<Allele[]>(
      this.allelesHistoryUrl,
      options
    ).pipe(map((rawAlleles: object[]) => Allele.fromJsonArray(rawAlleles)));
  }

  public deleteAllele(alleleId: number): Observable<object> {
    const options = { headers: {'X-CSRFToken': this.getCSRFToken()}, withCredentials: true };
    return this.http.delete(`${this.allelesHistoryUrl}?id=${alleleId}`, options);
  }
}
