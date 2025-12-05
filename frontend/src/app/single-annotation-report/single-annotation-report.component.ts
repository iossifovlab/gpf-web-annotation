import { Component, ElementRef, Input, TemplateRef, ViewChild } from '@angular/core';
import { Annotator, SingleAnnotationReport } from '../single-annotation';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { HistogramWrapperComponent } from '../histogram-wrapper/histogram-wrapper.component';
import { EffectTableComponent } from '../effect-table/effect-table.component';
import { saveAs } from 'file-saver';
import { MatDialog } from '@angular/material/dialog';

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
  public showFullReport = false;
  @ViewChild('infoModal') public infoModalRef: TemplateRef<ElementRef>;


  public constructor(
    private dialog: MatDialog,
  ) { }

  public showInfo(annotator: Annotator): void {
    this.dialog.open(this.infoModalRef, {
      data: annotator,
      width: '50vw',
      maxWidth: '1000px',
      minWidth: '500px',
      maxHeight: '700px',
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
        const val = attribute.result.value;
        if (val instanceof Map) {
          val.forEach((v, k) => {
            value += `${k}:${v};`;
          });
          if (value.length > 0) {
            value = value.slice(0, -1); // Remove trailing ;
          }
        } else if (val !== null) {
          if (typeof val === 'object') {
            try {
              value = JSON.stringify(val);
            } catch {
              value = String(val);
            }
          } else {
            value = String(val);
          }
        } else {
          value = 'N/A';
        }
        reportLines += `${attribute.name}\t${value}\n`;
      });
    });
    reportLines.trim();
    const content = new Blob([reportLines], {type: 'text/plain;charset=utf-8'});
    saveAs(content, fileName);
  }
}
