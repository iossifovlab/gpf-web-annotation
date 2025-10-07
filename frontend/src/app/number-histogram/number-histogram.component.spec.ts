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

  it('should display red mark on histogram and single score value', () => {
    component.singleScoreValue = 2;
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const redLine = svg.querySelector('.single-score-marker');
    expect(redLine).toBeTruthy();
    expect(redLine.getAttribute('x1')).toBe('152.4193548387097');
    expect(redLine.getAttribute('x2')).toBe('152.4193548387097');
    expect(redLine.getAttribute('y1')).toBe('33.333333333333336');
    expect(redLine.getAttribute('y2')).toBe('-5');
    expect(redLine.getAttribute('style')).toBe('stroke: rgb(255, 0, 0); stroke-width: 2;');

    const valueText = svg.querySelector('.single-score-value');
    expect(valueText.textContent).toBe('2');
    expect(valueText.getAttribute('x')).toBe('152.4193548387097');
    expect(valueText.getAttribute('text-anchor')).toBe('middle');
  });

  it('should not display red mark on histogram and value when there is no value', () => {
    component.singleScoreValue = null;
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const redLine = svg.querySelector('.single-score-marker');
    expect(redLine).toBeFalsy();

    const valueText = svg.querySelector('.single-score-value');
    expect(valueText).toBeFalsy();
  });
});
