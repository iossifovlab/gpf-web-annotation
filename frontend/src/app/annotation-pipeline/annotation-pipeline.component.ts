import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { take } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { SingleAnnotationService } from '../single-annotation.service';
import { JobCreationView } from '../job-creation/jobs';
import { Pipeline } from '../job-creation/pipelines';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-annotation-pipeline',
  imports: [CommonModule, FormsModule],
  templateUrl: './annotation-pipeline.component.html',
  styleUrl: './annotation-pipeline.component.css'
})

export class AnnotationPipelineComponent implements OnInit {
  public view: JobCreationView = 'pipeline list';
  public pipelines : Pipeline[] = [];
  public pipelineId = '';
  public ymlConfig = '';
  public configError = '';
  @Output() public emitPipelineId = new EventEmitter<string>();
  @Output() public emitConfig = new EventEmitter<string>();
  @Output() public emitView = new EventEmitter<JobCreationView>();
  @Output() public emitIsConfigValid = new EventEmitter<boolean>();

  public constructor(
    private jobsService: JobsService,
    private singleAnnotationService: SingleAnnotationService,
  ) { }

  public ngOnInit(): void {
    this.emitView.emit(this.view);

    this.jobsService.getAnnotationPipelines().pipe(take(1)).subscribe(pipelines => {
      this.pipelines = pipelines;
    });
  }

  public resetState(): void {
    this.changeView('pipeline list');
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

  public changeView(view: JobCreationView): void {
    if (view === 'pipeline list') {
      this.ymlConfig = '';
      this.configError = '';
    } else {
      this.pipelineId = '';
    }
    this.view = view;
    this.emitView.emit(this.view);
    this.emitConfig.emit(this.ymlConfig);
    this.emitPipelineId.emit(this.pipelineId);
  }

  public onPipelineClick(option: string): void {
    this.pipelineId = option;
    this.emitPipelineId.emit(this.pipelineId);
  }
}
