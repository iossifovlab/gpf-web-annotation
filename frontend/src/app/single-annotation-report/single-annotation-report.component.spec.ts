import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationReportComponent } from './single-annotation-report.component';
import { Observable, of } from 'rxjs';
import { Annotator, AnnotatorType, SingleAnnotationReport, Variant } from '../single-annotation';
import { SingleAnnotationService } from '../single-annotation.service';
import { provideRouter } from '@angular/router';

const mockReport = new SingleAnnotationReport(
  new Variant('chr14', '204000100', 'A', 'AA', 'ins'),
  [
    new Annotator({} as AnnotatorType, [])
  ],
);
class MockSingleAnnotationService {
  public getReport(): Observable<SingleAnnotationReport> {
    return of(mockReport);
  }
}
describe('SingleAnnotationReportComponent', () => {
  let component: SingleAnnotationReportComponent;
  let fixture: ComponentFixture<SingleAnnotationReportComponent>;
  const mockSingleAnnotationService = new MockSingleAnnotationService();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationReportComponent],
      providers: [
        {
          provide: SingleAnnotationService,
          useValue: mockSingleAnnotationService
        },
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SingleAnnotationReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get report from service', () => {
    component.ngOnInit();
    expect(component.report).toBe(mockReport);
  });
});
