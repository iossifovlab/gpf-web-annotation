import { Component, Input, OnChanges } from '@angular/core';
import { SingleAnnotationService } from '../single-annotation.service';
import { SingleAnnotationReport, Variant } from '../single-annotation';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { HelperModalComponent } from '../helper-modal/helper-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { HistogramWrapperComponent } from '../histogram-wrapper/histogram-wrapper.component';
import { EffectTableComponent } from '../effect-table/effect-table.component';

@Component({
  selector: 'app-single-annotation-report',
  imports: [
    CommonModule,
    MarkdownModule,
    HistogramWrapperComponent,
    EffectTableComponent
  ],
  templateUrl: './single-annotation-report.component.html',
  styleUrl: './single-annotation-report.component.css'
})
export class SingleAnnotationReportComponent implements OnChanges {
  public report: SingleAnnotationReport = null;
  public tableViewSources = ['effect_details', 'gene_effects'];
  @Input() public variant: string = '';
  @Input() public pipelineId: string = '';

  public constructor(
    private singleAnnotationService: SingleAnnotationService,
    private dialog: MatDialog,
  ) { }

  public ngOnChanges(): void {
    this.getReport();
  }

  private getReport(): void {
    this.singleAnnotationService.getReport(
      this.parseVariantToObject(this.variant),
      this.pipelineId
    ).subscribe(report => {
      this.report = report;
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
