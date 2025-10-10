import { Component, OnInit } from '@angular/core';
import { SingleAnnotationService } from '../single-annotation.service';
import { SingleAnnotationReport, Variant } from '../single-annotation';
import { CommonModule } from '@angular/common';
import { switchMap, take } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MarkdownModule } from 'ngx-markdown';
import { HelperModalComponent } from '../helper-modal/helper-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { HistogramWrapperComponent } from '../histogram-wrapper/histogram-wrapper.component';

@Component({
  selector: 'app-single-annotation-report',
  imports: [
    CommonModule,
    MarkdownModule,
    HistogramWrapperComponent],
  templateUrl: './single-annotation-report.component.html',
  styleUrl: './single-annotation-report.component.css'
})
export class SingleAnnotationReportComponent implements OnInit {
  public report: SingleAnnotationReport = null;

  public constructor(
    private singleAnnotationService: SingleAnnotationService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
  ) { }

  public ngOnInit(): void {
    this.route.queryParams.pipe(
      take(1),
      switchMap(params => {
        return this.singleAnnotationService.getReport(
          this.parseVariantToObject(params['variant'] as string),
          params['genome'] as string
        );
      })
    ).subscribe(report => {
      this.clearQueryParams();
      this.report = report;
    });
  }

  private clearQueryParams(): void {
    this.router.navigate([], {
      queryParams: {},
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
    });
  }
}
