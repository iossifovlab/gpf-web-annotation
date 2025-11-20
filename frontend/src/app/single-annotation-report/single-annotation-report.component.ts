import { Component, Input } from '@angular/core';
import { SingleAnnotationReport } from '../single-annotation';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { HelperModalComponent } from '../helper-modal/helper-modal.component';
import { MatDialog } from '@angular/material/dialog';
import { HistogramWrapperComponent } from '../histogram-wrapper/histogram-wrapper.component';
import { EffectTableComponent } from '../effect-table/effect-table.component';
import { saveAs } from 'file-saver';

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
export class SingleAnnotationReportComponent {
  @Input() public report: SingleAnnotationReport = null;
  public tableViewSources = ['effect_details', 'gene_effects'];

  public constructor(
    private dialog: MatDialog,
  ) { }

  public showHelp(content: string): void {
    this.dialog.open(HelperModalComponent, {
      data: content,
      height: '60vh',
      width: '30vw',
      maxWidth: '1000px',
      minHeight: '400px'
    });
  }

  public saveReport(): void {
    const fileName = `${this.report.variant.chromosome}_${this.report.variant.position}`
      + `_${this.report.variant.reference}_${this.report.variant.alernative}`
      + '_report.tsv';
    let reportLines: string = 'Attribute name\tValue\n';
    this.report.annotators.forEach(annotator => {
      annotator.attributes.forEach(attribute => {
        let value = '';
        if (attribute.result.value instanceof Map) {
          attribute.result.value.forEach((v, k) => {
            value += `${k}:${v};`
          });
          value = value.slice(0, -1); // Remove trailing ;
        } else {
          value = `${attribute.result.value}`;
        }
        reportLines += `${attribute.name}\t${value}\n`;
      });
    });
    reportLines.trim();
    const content = new Blob([reportLines], {type: 'text/plain;charset=utf-8'});
    saveAs(content, fileName);
  }
}
