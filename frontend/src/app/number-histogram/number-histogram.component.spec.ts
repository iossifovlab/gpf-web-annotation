import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumberHistogramComponent } from './number-histogram.component';
import { NumberHistogram } from '../single-annotation';

const mockHistogram = new NumberHistogram(
  [207, 211, 506],
  [1, 2, 3, 4],
  'small values',
  'large values',
  1,
  3,
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
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display red mark on histogram and single score value', () => {
    component.scoreValues = [2];
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const redLine = svg.querySelector('.single-score-marker');
    expect(redLine).toBeTruthy();
    expect(redLine.getAttribute('x1')).toBe('115.2439024390244');
    expect(redLine.getAttribute('x2')).toBe('115.2439024390244');
    expect(redLine.getAttribute('y1')).toBe('49.90118577075099');
    expect(redLine.getAttribute('y2')).toBe('-5');
    expect(redLine.getAttribute('style')).toBe('stroke: rgb(255, 0, 0); stroke-width: 2;');

    const valueText = svg.querySelector('.single-score-value');
    expect(valueText.textContent).toBe('2');
    expect(valueText.getAttribute('x')).toBe('115.2439024390244');
    expect(valueText.getAttribute('text-anchor')).toBe('middle');
  });

  it('should not display red mark on histogram and value when there is no value', () => {
    component.scoreValues = [];
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const redLine = svg.querySelector('.single-score-marker');
    expect(redLine).toBeFalsy();

    const valueText = svg.querySelector('.single-score-value');
    expect(valueText).toBeFalsy();
  });

  it('should set up xScale, scaleXAxis and scaleYAxis correctly', () => {
    component.ngOnInit();
    expect(component.histogram.bars).toHaveLength(4);
    expect(component.histogram.bins).toHaveLength(4);
    expect(component.xScale.domain()).toStrictEqual(['0', '1', '2', '3']);
    expect(component.xScale.range()).toStrictEqual([0, 450]);

    expect(component.scaleYAxis.range()).toStrictEqual([50, 0]);
    expect(component.scaleYAxis.domain()).toStrictEqual([0, 506]);

    expect(component.scaleXAxis.range()).toStrictEqual([
      0,
      5.487804878048774,
      115.2439024390244,
      225,
      450
    ]);
    expect(component.scaleXAxis.domain()).toStrictEqual([1, 2, 3, 4]);
  });

  it('should create svg rects for each bar', () => {
    component.ngOnInit();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const rects = svg.querySelectorAll('rect');
    expect(rects).toHaveLength(4);
    expect(rects[0].getAttribute('style')).toContain('fill: steelblue');
    expect(rects[0].getAttribute('y')).toBe('29.54545454545454');
    expect(rects[0].getAttribute('height')).toBe('20.45454545454546');
    expect(rects[3].getAttribute('height')).toBe('0');
  });

  it('should create svg x and y axis ticks', () => {
    component.ngOnInit();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const ticks = svg.querySelectorAll('.tick text');
    expect(ticks).toHaveLength(6);
    // x axis
    expect(ticks[0].textContent).toBe('1');
    expect(ticks[1].textContent).toBe('2');
    expect(ticks[2].textContent).toBe('3');
    // y axis
    expect(ticks[3].textContent).toBe('0');
    expect(ticks[4].textContent).toBe('200');
    expect(ticks[5].textContent).toBe('400');
  });

  it('should use log scale for Y axis when logScaleY is true', () => {
    component.histogram = new NumberHistogram(
      [1, 2, 3],
      [1, 2, 3, 4],
      'small values',
      'large values',
      1,
      3,
      false,
      true
    );
    component.ngOnInit();
    expect(component.scaleYAxis.domain()[0]).toBe(1);
  });

  it('should handle bars with zero value', () => {
    component.histogram = new NumberHistogram(
      [0, 2, 3],
      [1, 2, 3, 4],
      'small values',
      'large values',
      1,
      3,
      false,
      false
    );
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    const rects = svg.querySelectorAll('rect');
    expect(rects[0].getAttribute('y')).toBe('50');
    expect(rects[0].getAttribute('height')).toBe('0');
  });

  it('should return xLabels if defined', () => {
    component.xLabels = [10, 20, 30];
    expect(component.xLabelsWithDefaultValue()).toStrictEqual([10, 20, 30]);
  });

  it('should return bins.slice(0, -1) if bins.length < 10 and xLabels is undefined', () => {
    component.xLabels = undefined;
    component.histogram = new NumberHistogram(
      [1, 2, 3],
      [1, 2, 3, 4],
      'small values',
      'large values',
      1,
      3,
      false,
      false
    );
    expect(component.xLabelsWithDefaultValue()).toStrictEqual([1, 2, 3]);
  });

  it('should return d3.ticks for bins.length >= 10 and logScaleX is false', () => {
    component.xLabels = undefined;
    component.histogram = new NumberHistogram(
      Array(10).fill(1) as number[],
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      'small values',
      'large values',
      0,
      10,
      false,
      false
    );
    const result = component.xLabelsWithDefaultValue();
    expect(result).toHaveLength(8);
    expect(result).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('should return log scale ticks for bins.length >= 10 and logScaleX is true', () => {
    component.xLabels = undefined;
    component.histogram = new NumberHistogram(
      Array(10).fill(1) as number[],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      'small values',
      'large values',
      1,
      10,
      true, // logScaleX
      false
    );
    expect(component.xLabelsWithDefaultValue()).toStrictEqual([1, 10]);
  });

  it('should use bins[1] as domainMin if bins[0] is 0 for logScaleX', () => {
    component.xLabels = undefined;
    component.histogram = new NumberHistogram(
      Array(10).fill(1) as number[],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      'small values',
      'large values',
      0,
      10,
      true,
      false
    );
    expect(component.xLabelsWithDefaultValue()).toStrictEqual([1, 10]);
  });

  it('should return if bins are more than 10 and logScaleX is false', () => {
    component.xLabels = undefined;
    component.histogram = new NumberHistogram(
      Array(10).fill(1) as number[],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      'small values',
      'large values',
      0,
      20,
      false, // logScaleX
      false
    );
    expect(component.xLabelsWithDefaultValue()).toStrictEqual([0, 2, 4, 6, 8, 10, 12, 14]);
  });

  it('should return x labes if they are defined', () => {
    component.xLabels = [5, 15, 25];
    expect(component.xLabelsWithDefaultValue()).toStrictEqual([5, 15, 25]);
  });
  it('should format score value', () => {
    component.scoreValues = [0.123456789];
    fixture.detectChanges();
    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;

    const valueText = svg.querySelector('.single-score-value');
    expect(valueText.innerHTML).toBe('0.123');
  });
});
