import { Component, OnInit } from '@angular/core';
import { SingleAnnotationService } from '../single-annotation.service';
import { SingleAnnotationReport, Variant } from '../single-annotation';
import { CommonModule } from '@angular/common';
import { of, switchMap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { HelperModalComponent } from '../helper-modal/helper-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { HistogramWrapperComponent } from '../histogram-wrapper/histogram-wrapper.component';
import { EffectTableComponent } from '../effect-table/effect-table.component';
import { SingleAnnotationComponent } from '../single-annotation/single-annotation.component';

@Component({
  selector: 'app-single-annotation-report',
  imports: [
    CommonModule,
    MarkdownModule,
    HistogramWrapperComponent,
    EffectTableComponent,
    SingleAnnotationComponent
  ],
  templateUrl: './single-annotation-report.component.html',
  styleUrl: './single-annotation-report.component.css'
})
export class SingleAnnotationReportComponent implements OnInit {
  public report: SingleAnnotationReport = null;
  public tableViewSources = ['effect_details', 'gene_effects'];

  public constructor(
    private singleAnnotationService: SingleAnnotationService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
  ) { }

  public ngOnInit(): void {
    this.route.queryParams.pipe(
      switchMap(params => {
        if (!params['variant'] && !params['genome']) {
          return of(null);
        }
        return this.singleAnnotationService.getReport(
          this.parseVariantToObject(params['variant'] as string),
          params['genome'] as string
        );
      })
    ).subscribe(report => {
      if (!report) {
        this.router.navigate(['/single-annotation']);
      } else {
        this.report = report;
      }
    });
  }

  private parseVariantToObject(variant: string): Variant {
    const variantFields = variant.split(' ');
    return new Variant(variantFields[0], Number(variantFields[1]), variantFields[2], variantFields[3], null);
  }

  public showHelp(content: string): void {
    this.dialog.open(HelperModalComponent, {
      data: content,
      height: '60vh',
      width: '30vw',
      maxWidth: '1000px',
      minHeight: '400px'
    });
  }
}
