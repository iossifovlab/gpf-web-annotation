import { Component } from '@angular/core';
import { JobsTableComponent } from '../jobs-table/jobs-table.component';
import { Observable, take } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { AnnotationPipelineComponent } from '../annotation-pipeline/annotation-pipeline.component';
import { JobCreationView } from '../job-creation/jobs';
import { JobCreationComponent } from '../job-creation/job-creation.component';

@Component({
  selector: 'app-annotation-wrapper',
  imports: [JobsTableComponent, AnnotationPipelineComponent, JobCreationComponent],
  templateUrl: './annotation-wrapper.component.html',
  styleUrl: './annotation-wrapper.component.css'
})

export class AnnotationWrapperComponent {
  public file: File = null;
  public fileSeparator: string = null;
  public fileHeader = new Map<string, string>();
  public pipelineId = '';
  public ymlConfig = '';
  public isConfigValid = true;
  public creationError = '';
  public view: JobCreationView = 'pipeline list';
  public selectedGenome = '';

  public constructor(
      private jobsService: JobsService,
  ) { }

  public onCreateClick(): void {
    if (this.file) {
      let createObservable: Observable<object>;
      if (this.file.type !== 'text/vcard') {
        if (this.view === 'text editor') {
          createObservable = this.jobsService.createNonVcfJob(
            this.file,
            null,
            this.ymlConfig,
            this.selectedGenome,
            this.fileSeparator,
            this.fileHeader
          );
        } else {
          createObservable = this.jobsService.createNonVcfJob(
            this.file,
            this.pipelineId,
            null,
            this.selectedGenome,
            this.fileSeparator,
            this.fileHeader
          );
        }
      } else if (this.file.type === 'text/vcard') {
        if (this.view === 'text editor') {
          createObservable = this.jobsService.createVcfJob(
            this.file,
            null,
            this.ymlConfig,
            this.selectedGenome,
          );
        } else {
          createObservable = this.jobsService.createVcfJob(
            this.file,
            this.pipelineId,
            null,
            this.selectedGenome,
          );
        }
      }
      createObservable.pipe(take(1)).subscribe({
        next: () => {
          this.ymlConfig = '';
        },
        error: (err: Error) => {
          this.creationError = err.message;
        }
      });
    }
  }

  public onCancelClick(): void {
    this.clearErrorMessage();
  }

  public setPipeline(newPipeline: string): void {
    this.pipelineId = newPipeline;
  }

  public setConfig(newConfig: string): void {
    this.ymlConfig = newConfig;
  }

  public clearErrorMessage(): void {
    this.creationError = '';
  }

  public setView(newView: JobCreationView): void {
    this.view = newView;
  }

  public setGenome(genome: string): void {
    this.selectedGenome = genome;
  }

  public setConfigValid(newState: boolean): void {
    this.isConfigValid = newState;
  }

  public setFile(newFile: File): void {
    this.file = newFile;
  }

  public setFileSeparator(newSeparator: string): void {
    this.fileSeparator = newSeparator;
  }

  public setUpdatedFileHeader(newHeader: Map<string, string>): void {
    this.fileHeader = newHeader;
    this.disableCreate();
  }

  public disableCreate(): boolean {
    return !this.file
      || !this.fileHeader
      || !this.isConfigValid
      || (this.view === 'text editor' ? !this.ymlConfig : !this.pipelineId);
  }
}
