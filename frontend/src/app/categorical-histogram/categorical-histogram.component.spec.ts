import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoricalHistogramComponent } from './categorical-histogram.component';
import { CategoricalHistogram } from '../single-annotation';

describe('CategoricalHistogramComponent', () => {
  let component: CategoricalHistogramComponent;
  let fixture: ComponentFixture<CategoricalHistogramComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [CategoricalHistogramComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CategoricalHistogramComponent);
    component = fixture.componentInstance;

    component.histogram = new CategoricalHistogram(
      [
        { name: 'A', value: 0 },
        { name: 'B', value: 10 },
        { name: 'C', value: 20 },
        { name: 'D', value: 30 },
        { name: 'E', value: 40 },
      ],
      [],
      'largeValues',
      'smallValues',
      false,
      0
    );
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize component properties', () => {
    component.ngOnInit();
    expect(component.labelRotation).toBe(0);
    expect(component.values).toStrictEqual([
      { name: 'A', value: 0 },
      { name: 'B', value: 10 },
      { name: 'C', value: 20 },
      { name: 'D', value: 30 },
      { name: 'E', value: 40 },
    ]);
  });

  it('should draw histogram', () => {
    component.ngOnInit();

    expect(component.xScale.domain()).toStrictEqual(['A', 'B', 'C', 'D', 'E']);
    expect(component.xScale.bandwidth()).toBe(79.41176470588235);
    expect(component.scaleYAxis.domain()).toStrictEqual([0, 40]);
    expect(component.scaleYAxis.range()).toStrictEqual([50, 0]);
    expect(component.scaleXAxis.domain()).toStrictEqual(['', 'A', 'B', 'C', 'D', 'E']);
    expect(component.scaleXAxis.range()).toStrictEqual([
      0,
      48.5294117647059,
      136.76470588235293,
      225,
      313.235294117647,
      401.4705882352941,
      450
    ]);
  });

  it('should check svg of histogram', () => {
    component.ngOnInit();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    expect(svg.querySelectorAll('rect')).toHaveLength(5);
    expect(svg.querySelectorAll('g')).toHaveLength(14);
    expect(svg.querySelectorAll('line')).toHaveLength(10);
    expect(svg.querySelectorAll('text')).toHaveLength(10);
    expect(svg.querySelectorAll('text')[1].textContent).toBe('A');
    expect(svg.querySelectorAll('text')[1].style.getPropertyValue('text-anchor')).toBe('center');
    expect(svg.querySelectorAll('text')[1].getAttribute('transform')).toBe('rotate(0)');
  });

  it('should draw histogram with log scale y', () => {
    component.histogram = new CategoricalHistogram(
      [
        { name: 'A', value: 0 },
        { name: 'B', value: 10 },
        { name: 'C', value: 20 },
        { name: 'D', value: 30 },
        { name: 'E', value: 40 },
      ],
      [],
      'largeValues',
      'smallValues',
      true,
      0
    );
    component.ngOnInit();

    expect(component.xScale.domain()).toStrictEqual(['A', 'B', 'C', 'D', 'E']);
    expect(component.xScale.bandwidth()).toBe(79.41176470588235);
    expect(component.scaleYAxis.domain()).toStrictEqual([1, 40]);
    expect(component.scaleYAxis.range()).toStrictEqual([50, 0]);
    expect(component.scaleXAxis.domain()).toStrictEqual(['', 'A', 'B', 'C', 'D', 'E']);
    expect(component.scaleXAxis.range()).toStrictEqual([
      0,
      48.5294117647059,
      136.76470588235293,
      225,
      313.235294117647,
      401.4705882352941,
      450
    ]);
  });

  it('should check svg of histogram with label rotation 80', () => {
    component.histogram = new CategoricalHistogram(
      [
        { name: 'A', value: 0 },
        { name: 'B', value: 10 },
        { name: 'C', value: 20 },
        { name: 'D', value: 30 },
        { name: 'E', value: 40 },
      ],
      [],
      'largeValues',
      'smallValues',
      false,
      80
    );
    component.ngOnInit();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    expect(svg.querySelectorAll('text')[1].textContent).toBe('A');
    expect(svg.querySelectorAll('text')[1].style.getPropertyValue('text-anchor')).toBe('end');
    expect(svg.querySelectorAll('text')[1].getAttribute('transform')).toBe('rotate(280)');
  });

  it('should check svg of histogram with label rotation 250', () => {
    component.histogram = new CategoricalHistogram(
      [
        { name: 'A', value: 0 },
        { name: 'B', value: 10 },
        { name: 'C', value: 20 },
        { name: 'D', value: 30 },
        { name: 'E', value: 40 },
      ],
      [],
      'largeValues',
      'smallValues',
      false,
      250
    );
    component.ngOnInit();

    const svg = (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGElement;
    expect(svg.querySelectorAll('text')[1].textContent).toBe('A');
    expect(svg.querySelectorAll('text')[1].style.getPropertyValue('text-anchor')).toBe('start');
    expect(svg.querySelectorAll('text')[1].getAttribute('transform')).toBe('rotate(110)');
  });
});
