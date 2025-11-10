import { Component } from '@angular/core';
import { JobsTableComponent } from '../jobs-table/jobs-table.component';

@Component({
  selector: 'app-annotation-wrapper',
  imports: [JobsTableComponent],
  templateUrl: './annotation-wrapper.component.html',
  styleUrl: './annotation-wrapper.component.css'
})
export class AnnotationWrapperComponent {

}
