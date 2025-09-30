import { Component, OnInit } from '@angular/core';
import { SingleAnnotationService } from '../single-annotation.service';
import { SingleAnnotationReport } from '../single-annotation';
import { CommonModule } from '@angular/common';
import { switchMap, take } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-single-annotation-report',
  imports: [CommonModule],
  templateUrl: './single-annotation-report.component.html',
  styleUrl: './single-annotation-report.component.css'
})
export class SingleAnnotationReportComponent implements OnInit {
  public report: SingleAnnotationReport = null;

  public constructor(
    private singleAnnotationService: SingleAnnotationService,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

  public ngOnInit(): void {
    this.route.queryParams.pipe(
      take(1),
      switchMap(params => {
        return this.singleAnnotationService.getReport(
          params['variant'] as string,
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
}
