import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumberHistogramComponent } from './number-histogram.component';
import { NumberHistogram } from '../single-annotation';

const mockHistogram = new NumberHistogram(
  [1, 2, 3],
  [1, 2, 3],
  'small values',
  'large values',
  0,
  10,
  false,
  false
);

describe('NumberHistogramComponent', () => {
  let component: NumberHistogramComponent;
  let fixture: ComponentFixture<NumberHistogramComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [NumberHistogramComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(NumberHistogramComponent);
    component = fixture.componentInstance;

    component.histogram = mockHistogram;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
