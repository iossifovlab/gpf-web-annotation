import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { map, Observable, of, startWith, take } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { SingleAnnotationService } from '../single-annotation.service';
import { Pipeline } from '../job-creation/pipelines';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-annotation-pipeline',
  imports: [CommonModule, FormsModule, MatAutocompleteModule, MatFormFieldModule, ReactiveFormsModule, FormsModule],
  templateUrl: './annotation-pipeline.component.html',
  styleUrl: './annotation-pipeline.component.css'
})

export class AnnotationPipelineComponent implements OnInit {
  public pipelines : Pipeline[] = [];
  public pipelineId = '';
  public ymlConfig = '';
  public configError = '';
  @Output() public emitPipelineId = new EventEmitter<string>();
  @Output() public emitConfig = new EventEmitter<string>();
  @Output() public emitIsConfigValid = new EventEmitter<boolean>();
  public filteredPipelines$: Observable<string[]> = null;
  public dropdownControl = new FormControl<string>('');

  public constructor(
    private jobsService: JobsService,
    private singleAnnotationService: SingleAnnotationService,
  ) { }

  public ngOnInit(): void {
    this.jobsService.getAnnotationPipelines().pipe(take(1)).subscribe(pipelines => {
      this.pipelines = pipelines;
      this.filteredPipelines$ = of(this.pipelines.map(p => p.id));
      this.onPipelineClick(this.pipelines[0].id);
      this.dropdownControl.setValue(this.pipelineId);
    });

    this.filteredPipelines$ = this.dropdownControl.valueChanges.pipe(
      startWith(''),
      map(value => this.filter(value || '')),
    );
  }

  private filter(value: string): string[] {
    const filterValue = this.normalizeValue(value);
    return this.pipelines.map(p => p.id).filter(pipelineId => this.normalizeValue(pipelineId).includes(filterValue));
  }

  private normalizeValue(value: string): string {
    return value.toLowerCase().replace(/\s/g, '');
  }

  public resetState(): void {
    this.onPipelineClick('');
  }

  public isConfigValid(config: string): void {
    this.jobsService.validateJobConfig(config).pipe(
      take(1)
    ).subscribe((errorReason: string) => {
      this.configError = errorReason;
      if (!this.configError) {
        this.emitConfig.emit(config);
        this.emitIsConfigValid.emit(true);
      } else {
        this.emitIsConfigValid.emit(false);
      }
    });
  }

  public onPipelineClick(option: string): void {
    this.pipelineId = option;
    this.emitPipelineId.emit(this.pipelineId);
  }
}
