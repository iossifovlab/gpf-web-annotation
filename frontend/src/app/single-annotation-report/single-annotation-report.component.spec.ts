import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationReportComponent } from './single-annotation-report.component';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Annotator, AnnotatorDetails, SingleAnnotationReport, Variant } from '../single-annotation';
import { SingleAnnotationService } from '../single-annotation.service';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';

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

describe('SingleAnnotationReportComponent', () => {
  let component: SingleAnnotationReportComponent;
  let fixture: ComponentFixture<SingleAnnotationReportComponent>;
  const mockSingleAnnotationService = new MockSingleAnnotationService();
  let router: Router;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationReportComponent],
      providers: [
        {
          provide: SingleAnnotationService,
          useValue: mockSingleAnnotationService
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
});
