import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationReportComponent } from './single-annotation-report.component';
import { BehaviorSubject } from 'rxjs';
import { Annotator, AnnotatorDetails, Attribute, Result, SingleAnnotationReport, Variant } from '../single-annotation';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { HelperModalComponent } from '../helper-modal/helper-modal.component';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';


class MatDialogMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public open(component: HelperModalComponent, config: MatDialogConfig<string>): MatDialogRef<HelperModalComponent> {
    return null;
  }
}

describe('SingleAnnotationReportComponent', () => {
  let component: SingleAnnotationReportComponent;
  let fixture: ComponentFixture<SingleAnnotationReportComponent>;
  const mockMatDialog = new MatDialogMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationReportComponent],
      providers: [
        {
          provide: MatDialog,
          useValue: mockMatDialog
        },
        JobsService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideMarkdown()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SingleAnnotationReportComponent);
    component = fixture.componentInstance;

    const activatedRoute = TestBed.inject(ActivatedRoute);
    (activatedRoute.queryParams as BehaviorSubject<{variant: string, pipeline: string}>).next({
      variant: 'chr14 204000100 A AA',
      pipeline: 'pipeline'
    });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should open modal on icon click', () => {
    const openModalSpy = jest.spyOn(mockMatDialog, 'open').mockImplementation(() => null);
    component.showHelp('mock markdown content');
    expect(openModalSpy).toHaveBeenCalledWith(
      HelperModalComponent, {
        data: 'mock markdown content',
        height: '60vh',
        width: '30vw',
        maxWidth: '1000px',
        minHeight: '400px',
      }
    );
  });

  it('should display true, false and 0 when there is no histogram', () => {
    const report = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
      [
        new Annotator(new AnnotatorDetails('allele_score', 'desc', 'resourceId', 'resourceUrl'), [
          new Attribute('attr1', 'desc1', 'AF', {value: 'true', histogramLink: null} as Result, ''),
          new Attribute('attr2', 'desc2', 'AF', {value: 'false', histogramLink: null} as Result, ''),
          new Attribute('attr3', 'desc3', 'AF', {value: 0, histogramLink: null} as Result, ''),
        ])
      ],
    );

    component.report = report;
    fixture.detectChanges();

    const allValueElements = (fixture.nativeElement as HTMLElement).querySelectorAll('.value-result');
    expect(allValueElements).toHaveLength(3);
    expect(allValueElements[0].innerHTML).toBe('true');
    expect(allValueElements[1].innerHTML).toBe('false');
    expect(allValueElements[2].innerHTML).toBe('0');
  });
});
