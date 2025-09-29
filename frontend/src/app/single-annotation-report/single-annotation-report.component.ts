import { Component, OnInit } from '@angular/core';
import { SingleAnnotationService } from '../single-annotation.service';
import { SingleAnnotationReport } from '../single-annotation';
import { CommonModule } from '@angular/common';
import { take } from 'rxjs';

@Component({
  selector: 'app-single-annotation-report',
  imports: [CommonModule],
  templateUrl: './single-annotation-report.component.html',
  styleUrl: './single-annotation-report.component.css'
})
export class SingleAnnotationReportComponent implements OnInit {
  public report: SingleAnnotationReport = null;

  public constructor(private singleAnnotationService: SingleAnnotationService) { }

  public ngOnInit(): void {
    this.singleAnnotationService.getReport().pipe(take(1)).subscribe(report => {
      this.report = report;
    });
  }
}
