import { Component, ViewChild } from '@angular/core';
import { JobsTableComponent } from '../jobs-table/jobs-table.component';
import { Observable, repeat, switchMap, take, takeWhile } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { AnnotationPipelineComponent } from '../annotation-pipeline/annotation-pipeline.component';
import { getStatusClassName, Job, Status } from '../job-creation/jobs';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { CommonModule } from '@angular/common';
import { SingleAnnotationComponent } from '../single-annotation/single-annotation.component';
import { AllelesTableComponent } from '../alleles-table/alleles-table.component';

@Component({
  selector: 'app-annotation-wrapper',
  imports: [
    CommonModule,
    JobsTableComponent,
    AnnotationPipelineComponent,
    JobCreationComponent,
    SingleAnnotationComponent,
    AllelesTableComponent
  ],
  templateUrl: './annotation-wrapper.component.html',
  styleUrl: './annotation-wrapper.component.css'
})

export class AnnotationWrapperComponent {
  public file: File = null;
  public fileSeparator: string = null;
  public fileHeader = new Map<string, string>();
  public pipelineId = '';
  public isConfigValid = true;
  public creationError = '';
  public selectedGenome = '';
  public isCreationFormVisible = true;
  @ViewChild(AnnotationPipelineComponent) public pipelinesComponent: AnnotationPipelineComponent;
  @ViewChild(JobCreationComponent) public createJobComponent: JobCreationComponent;
  @ViewChild(JobsTableComponent) public jobsTableComponent: JobsTableComponent;
  @ViewChild(AllelesTableComponent) public allelesTableComponent: AllelesTableComponent;
  public createdJobStatus: Status;
  public downloadLink = '';
  public annotatedFileName = '';
  public currentView:'jobs' | 'single allele' = 'jobs';

  public constructor(
      private jobsService: JobsService,
  ) { }

  public onCreateClick(): void {
    this.pipelinesComponent.autoSave().subscribe(annonymousPipelineName => {
      if (annonymousPipelineName) {
        this.pipelineId = annonymousPipelineName;
      }
      this.create();
    });
  }

  private create(): void {
    if (this.file) {
      let createObservable: Observable<number>;
      if (this.file.type !== 'text/vcard') {
        createObservable = this.jobsService.createNonVcfJob(
          this.file,
          this.pipelineId,
          this.selectedGenome,
          this.fileSeparator,
          this.fileHeader
        );
      } else if (this.file.type === 'text/vcard') {
        createObservable = this.jobsService.createVcfJob(
          this.file,
          this.pipelineId,
          this.selectedGenome,
        );
      }
      createObservable.pipe(
        take(1),
        switchMap((jobId: number) => {
          this.isCreationFormVisible = false;
          return this.trackJob(jobId);
        }),
      ).subscribe({
        next: (job: Job) => {
          if (this.createdJobStatus !== job.status) {
            this.jobsTableComponent.refreshTable();
            this.createdJobStatus = job.status;
            this.downloadLink = this.jobsService.getDownloadJobResultLink(job.id);
            this.annotatedFileName = job.annotatedFileName;
          }
        },
        error: (err: Error) => {
          this.creationError = err.message;
        }
      });
    }
  }

  private trackJob(jobId: number): Observable<Job> {
    return this.jobsService.getJobDetails(jobId).pipe(
      repeat({ delay: 5000 }),
      takeWhile((job: Job) => !this.isJobFinished(job.status), true)
    );
  }

  public showCreateMode(): void {
    this.isCreationFormVisible = true;
    this.createdJobStatus = undefined;
    this.downloadLink = '';
    this.file = null;
  }

  public onResetClick(): void {
    this.clearErrorMessage();
    this.pipelinesComponent.resetState();
    this.createJobComponent.removeFile();
  }

  public setPipeline(newPipeline: string): void {
    this.pipelineId = newPipeline;
    this.disableCreate();
  }

  public clearErrorMessage(): void {
    this.creationError = '';
  }

  public setGenome(genome: string): void {
    this.selectedGenome = genome;
  }

  public setConfigValid(newState: boolean): void {
    this.isConfigValid = newState;
    this.disableCreate();
  }

  public setFile(newFile: File): void {
    this.file = newFile;
    this.disableCreate();
  }

  public setFileSeparator(newSeparator: string): void {
    this.fileSeparator = newSeparator;
  }

  public setUpdatedFileHeader(newHeader: Map<string, string>): void {
    this.fileHeader = newHeader;
    this.disableCreate();
  }

  public isGenomeValid(): boolean {
    const genomeRequired = this.fileHeader.has('location') || this.fileHeader.has('variant');
    if (genomeRequired && this.selectedGenome === '') {
      return false;
    }
    return true;
  }

  public getStatusClass(): string {
    return getStatusClassName(this.createdJobStatus);
  }

  public disableCreate(): boolean {
    return !this.file
      || !this.fileHeader
      || !this.isConfigValid
      || !this.isGenomeValid();
  }

  public isJobFinished(status: Status): boolean {
    return status === 'success' || status === 'failed';
  }

  public switchView(view: 'jobs' | 'single allele'): void {
    this.currentView = view;
  }

  public refreshAllelesTable(): void {
    this.allelesTableComponent.refreshTable();
  }
}
