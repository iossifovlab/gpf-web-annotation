import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationReportComponent } from './single-annotation-report.component';

describe('SingleAnnotationReportComponent', () => {
  let component: SingleAnnotationReportComponent;
  let fixture: ComponentFixture<SingleAnnotationReportComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationReportComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SingleAnnotationReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
