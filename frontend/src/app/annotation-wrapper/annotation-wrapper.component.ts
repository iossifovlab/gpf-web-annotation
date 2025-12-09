import { Component, ViewChild, OnInit, OnDestroy, NgZone} from '@angular/core';
import { JobsTableComponent } from '../jobs-table/jobs-table.component';
import { Observable, repeat, switchMap, take, takeWhile } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { AnnotationPipelineComponent } from '../annotation-pipeline/annotation-pipeline.component';
import { getStatusClassName, Job, JobStatus } from '../job-creation/jobs';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { CommonModule } from '@angular/common';
import { SingleAnnotationComponent } from '../single-annotation/single-annotation.component';
import { AllelesTableComponent } from '../alleles-table/alleles-table.component';
import { UsersService } from '../users.service';
import { SocketNotificationsComponent } from '../socket-notifications/socket-notifications.component';

@Component({
  selector: 'app-annotation-wrapper',
  imports: [
    CommonModule,
    JobsTableComponent,
    AnnotationPipelineComponent,
    JobCreationComponent,
    SingleAnnotationComponent,
    AllelesTableComponent,
    SocketNotificationsComponent
  ],
  templateUrl: './annotation-wrapper.component.html',
  styleUrl: './annotation-wrapper.component.css'
})

export class AnnotationWrapperComponent implements OnInit, OnDestroy {
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
  @ViewChild(SingleAnnotationComponent) public singleAnnotationComponent: SingleAnnotationComponent;
  public downloadLink = '';
  public currentView:'jobs' | 'single allele' = 'single allele';
  public currentJob: Job = null;
  public hideComponents = false;
  public hideHistory = false;
  public isUserLoggedIn = false;

  public constructor(
      private jobsService: JobsService,
      private userService: UsersService,
      private ngZone: NgZone,
  ) { }

  public ngOnInit(): void {
    this.userService.userData.pipe(
    ).subscribe((userData) => {
      this.isUserLoggedIn = Boolean(userData);
    });
  }


  public ngOnDestroy(): void {
    this.userService.userData.pipe(
    ).subscribe((userData) => {
      this.isUserLoggedIn = Boolean(userData);
    });
  }

  public autoSavePipeline(): void {
    this.currentJob = null;
    this.pipelinesComponent.autoSave().pipe(take(1)).subscribe(annonymousPipelineName => {
      if (annonymousPipelineName) {
        this.pipelineId = annonymousPipelineName;
      }
      if (this.currentView === 'jobs') {
        this.create();
      } else {
        this.singleAnnotationComponent.annotateAllele(this.pipelineId);
      }
    });
  }

  public triggerSingleAlleleAnnotation(allele: string): void {
    this.singleAnnotationComponent.setAllele(allele);
    this.autoSavePipeline();
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
          if (!this.currentJob || this.currentJob.status !== job.status) {
            this.currentJob = job;
            if (this.isUserLoggedIn) {
              this.jobsTableComponent.refreshTable();
            }
            this.downloadLink = this.jobsService.getDownloadJobResultLink(job.id);
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
    this.resetJobState();
  }

  private resetJobState(): void {
    this.currentJob = null;
    this.downloadLink = '';
    this.file = null;
  }

  public setPipeline(newPipeline: string): void {
    if (this.pipelineId === newPipeline) {
      return;
    }
    this.resetSingleAlleleReport();
    this.pipelineId = newPipeline;
    this.disableCreate();
  }

  public clearErrorMessage(): void {
    this.creationError = '';
  }

  public resetSingleAlleleReport(): void {
    if (this.currentView === 'single allele') {
      this.singleAnnotationComponent.resetReport();
    }
  }

  public setGenome(genome: string): void {
    this.selectedGenome = genome;
  }

  public setConfigValid(newState: boolean): void {
    if (this.isConfigValid === newState) {
      return;
    }
    this.resetSingleAlleleReport();
    this.isConfigValid = newState;
    this.disableCreate();
  }

  public setFile(newFile: File): void {
    this.file = newFile;
    this.clearErrorMessage();
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
    return getStatusClassName(this.currentJob.status);
  }

  public disableCreate(): boolean {
    return !this.file
      || (this.file.type !== 'text/vcard' && !this.fileHeader)
      || !this.isConfigValid
      || (this.file.type !== 'text/vcard' && !this.isGenomeValid());
  }

  public isJobFinished(status: JobStatus): boolean {
    return status === 'success' || status === 'failed';
  }

  public switchView(view: 'jobs' | 'single allele'): void {
    if (this.currentView === view) {
      return;
    }
    if (this.currentView === 'single allele') {
      this.resetSingleAlleleReport();
    } else if (this.currentView === 'jobs') {
      if (this.isCreationFormVisible) {
        this.createJobComponent.resetState();
      }
      this.showCreateMode();
    }
    this.currentView = view;
  }

  public refreshAllelesTable(): void {
    this.allelesTableComponent.refreshTable();
  }

  public updateComponentsVisibility(toHide: boolean): void {
    this.ngZone.run(() => {
      this.hideComponents = toHide;
      this.hideHistory = toHide;
    });
  }

  public showComponents(): void {
    this.updateComponentsVisibility(false);
    this.pipelinesComponent.shrinkTextarea();
  }
}

