import { Component, Input, OnInit } from '@angular/core';
import { SingleAnnotationService } from '../single-annotation.service';
import { CategoricalHistogram, NumberHistogram } from '../single-annotation';
import { NumberHistogramComponent } from '../number-histogram/number-histogram.component';
import { CategoricalHistogramComponent } from '../categorical-histogram/categorical-histogram.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-histogram-wrapper',
  imports: [CommonModule, NumberHistogramComponent, CategoricalHistogramComponent],
  templateUrl: './histogram-wrapper.component.html'
})
export class HistogramWrapperComponent implements OnInit {
  @Input() public histogramUrl: string;
  @Input() public value: string | number;
  public histogram: CategoricalHistogram | NumberHistogram = null;

  public constructor(private singleAnnotationService: SingleAnnotationService) { }

  public ngOnInit(): void {
    if (this.histogramUrl) {
      this.singleAnnotationService.getHistogram(this.histogramUrl).subscribe((histogram) => {
        this.histogram = histogram;
      });
    }
  }

  public getValueAsNumber(value: string | number): number {
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number(value);
    if (isNaN(parsed)) {
      return null;
    }
    return parsed;
  }

  public getValueAsString(value: string | number): string {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    return value.toString();
  }

  public isCategoricalHistogram(arg: object): arg is CategoricalHistogram {
    return arg instanceof CategoricalHistogram;
  }

  public isNumberHistogram(arg: object): arg is NumberHistogram {
    return arg instanceof NumberHistogram;
  }
}
