import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationReportComponent } from './single-annotation-report.component';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Annotator, AnnotatorDetails, Attribute, Result, SingleAnnotationReport, Variant } from '../single-annotation';
import { SingleAnnotationService } from '../single-annotation.service';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { HelperModalComponent } from '../helper-modal/helper-modal.component';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';

const mockReport = new SingleAnnotationReport(
  new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
  [
    new Annotator(new AnnotatorDetails('allele_score', 'desc', ''), [])
  ],
);
class MockSingleAnnotationService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getReport(variant: Variant, genome: string): Observable<SingleAnnotationReport> {
    return of(mockReport);
  }
}

class MatDialogMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public open(component: HelperModalComponent, config: MatDialogConfig<string>): MatDialogRef<HelperModalComponent> {
    return null;
  }
}

describe('SingleAnnotationReportComponent', () => {
  let component: SingleAnnotationReportComponent;
  let fixture: ComponentFixture<SingleAnnotationReportComponent>;
  const mockSingleAnnotationService = new MockSingleAnnotationService();
  let router: Router;
  const mockMatDialog = new MatDialogMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationReportComponent],
      providers: [
        {
          provide: SingleAnnotationService,
          useValue: mockSingleAnnotationService
        },
        {
          provide: MatDialog,
          useValue: mockMatDialog
        },
        provideRouter([]),
        provideMarkdown()
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SingleAnnotationReportComponent);
    component = fixture.componentInstance;

    const activatedRoute = TestBed.inject(ActivatedRoute);
    (activatedRoute.queryParams as BehaviorSubject<{variant: string, genome: string}>).next({
      variant: 'chr14 204000100 A AA',
      genome: 'hg38'
    });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get report from service', () => {
    component.ngOnInit();
    expect(component.report).toBe(mockReport);
  });

  it('should check if query params from url are passed to get report method', () => {
    const getReportSpy = jest.spyOn(mockSingleAnnotationService, 'getReport');
    component.ngOnInit();
    expect(getReportSpy).toHaveBeenCalledWith(new Variant('chr14', 204000100, 'A', 'AA', null), 'hg38');
  });

  it('should call router.navigate to remove query params after requesting report', () => {
    const navigateSpy = jest.spyOn(router, 'navigate');
    component.ngOnInit();
    expect(navigateSpy).toHaveBeenCalledWith([], { queryParams: {} });
  });

  it('should open modal on icon click', () => {
    const openModalSpy = jest.spyOn(mockMatDialog, 'open').mockImplementation(() => null);
    component.showHelp('mock markdown content');
    expect(openModalSpy).toHaveBeenCalledWith(
      HelperModalComponent, {
        data: 'mock markdown content',
        height: '60vh',
        width: '30vw',
      }
    );
  });

  it('should display true, false and 0 when there is no histogram', () => {
    const report = new SingleAnnotationReport(
      new Variant('chr14', 204000100, 'A', 'AA', 'ins'),
      [
        new Annotator(new AnnotatorDetails('allele_score', 'desc', ''), [
          new Attribute('attr1', 'desc1', {value: 'true', histogramLink: null} as Result, ''),
          new Attribute('attr2', 'desc2', {value: 'false', histogramLink: null} as Result, ''),
          new Attribute('attr3', 'desc3', {value: 0, histogramLink: null} as Result, ''),
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
