import { Component, Input } from '@angular/core';
import { CategoricalHistogram } from '../single-annotation';

@Component({
  selector: 'app-categorical-histogram',
  imports: [],
  templateUrl: './categorical-histogram.component.html',
  styleUrl: './categorical-histogram.component.css'
})
export class CategoricalHistogramComponent {
  @Input() public histogram: CategoricalHistogram;
}
