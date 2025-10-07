import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { CategoricalHistogram } from '../single-annotation';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';
import { cloneDeep } from 'lodash';

@Component({
  selector: 'app-categorical-histogram',
  imports: [CommonModule],
  templateUrl: './categorical-histogram.component.html',
  styleUrl: './categorical-histogram.component.css'
})
export class CategoricalHistogramComponent implements OnInit {
  @Input() public histogram: CategoricalHistogram;

  @ViewChild('histogramContainer', {static: true}) public histogramContainer: ElementRef;

  // Values used as histogram bars
  public values: {name: string, value: number}[] = [];

  public labelRotation = 0;

  private svg: d3.Selection<SVGElement, unknown, null, undefined>;

  @Input() public singleScoreValue: string;

  public xScale: d3.ScaleBand<string>;
  public scaleXAxis: d3.ScaleOrdinal<string, number, never>;
  public scaleYAxis: d3.ScaleLinear<number, number, never>
                     | d3.ScaleLogarithmic<number, number, never>;

  public ngOnInit(): void {
    this.values = cloneDeep(this.histogram.values);
    this.labelRotation = this.histogram.labelRotation;

    this.drawHistogram();
  }

  private drawHistogram(): void {
    d3.select(this.histogramContainer.nativeElement).selectAll('g').remove();
    d3.select(this.histogramContainer.nativeElement).selectAll('rect').remove();

    const width = 450.0;
    const height = 50;

    const svg = d3.select(
      this.histogramContainer.nativeElement
    ) as d3.Selection<SVGElement, unknown, null, undefined>;

    this.xScale = d3.scaleBand()
      .padding(0.1)
      .domain(this.values.map(v => v.name))
      .range([0, width]);

    this.scaleYAxis = d3.scaleLinear();
    let domainStart = 0;
    if (this.histogram.logScaleY) {
      this.scaleYAxis = d3.scaleLog();
      domainStart = 1;
    }
    this.scaleYAxis.range([height, 0]).domain([domainStart, d3.max(this.values.map(v => v.value))]);

    this.redrawXAxis(svg, width, height);

    const leftAxis = d3.axisLeft(this.scaleYAxis);
    let yAxisTicks = this.scaleYAxis.ticks(3).filter((tick) => Number.isInteger(tick));
    // Force usage of 4 ticks even if d3 creates more
    if (yAxisTicks.length > 3) {
      yAxisTicks = [
        yAxisTicks[0],
        yAxisTicks[Math.floor(yAxisTicks.length / 3)],
        yAxisTicks[Math.floor(yAxisTicks.length / 3 * 2)],
        yAxisTicks[yAxisTicks.length - 1]
      ];
    }
    leftAxis.tickValues(yAxisTicks).tickFormat(d3.format('d'));

    svg.append('g')
      .call(leftAxis);
    svg.selectAll('bar')
      .data(this.values)
      .enter().append('rect')
      .style('fill', 'steelblue')
      .attr('x', (v: { name: string, value: number }) => this.xScale(v.name))
      .attr('width', this.xScale.bandwidth())
      .attr('y', (v: { name: string, value: number }) => v.value === 0 ? height : this.scaleYAxis(v.value))
      .attr('height', (v: { name: string, value: number }) =>
        v.value === 0 || v.value === undefined ? 0 : height - this.scaleYAxis(v.value))
      .attr('id', (v: { name: string, value: number }) => v.name);

    this.svg = svg;
  }

  private redrawXAxis(
    svg: d3.Selection<SVGElement, unknown, null, undefined>,
    width: number,
    height: number,
  ): void {
    const axisX: number[] = [0];
    const axisVals: string[] = [''];

    this.values.forEach(value => {
      const leftX = this.xScale(value.name) + this.xScale.bandwidth() / 2;
      axisX.push(leftX);
      axisVals.push(value.name);
    });

    axisX.push(width);
    axisVals.push('');
    this.scaleXAxis = d3.scaleOrdinal(axisVals, axisX);
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(this.scaleXAxis)
      ).style('font-size', '12px');

    let calculatedRotation = this.labelRotation;
    calculatedRotation %= 360;
    if (calculatedRotation !== 0 && calculatedRotation !== 90) {
      calculatedRotation = 360 - this.labelRotation; // Backend framework rotates labels in reverse
    }
    let anchorRotation = 'end';

    if (calculatedRotation === 0 || calculatedRotation === 180) {
      anchorRotation = 'center';
    } else if (calculatedRotation > 0 && calculatedRotation < 180) {
      anchorRotation = 'start';
    }
    svg.selectAll('text')
      .style('text-anchor', anchorRotation)
      .attr('transform-origin', '0 9%')
      .attr('transform', `rotate(${calculatedRotation})`);
  }
}
