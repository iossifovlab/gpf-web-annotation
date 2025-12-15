import { Component, ViewChild, OnInit, OnDestroy, NgZone} from '@angular/core';
import { JobsTableComponent } from '../jobs-table/jobs-table.component';
import { Observable, take } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { AnnotationPipelineComponent } from '../annotation-pipeline/annotation-pipeline.component';
import { getStatusClassName, Job, JobStatus } from '../job-creation/jobs';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { CommonModule } from '@angular/common';
import { SingleAnnotationComponent } from '../single-annotation/single-annotation.component';
import { AllelesTableComponent } from '../alleles-table/alleles-table.component';
import { UsersService } from '../users.service';
import { SocketNotificationsService } from '../socket-notifications/socket-notifications.service';
import { JobNotification } from '../socket-notifications/socket-notifications';

@Component({
  selector: 'app-annotation-wrapper',
  imports: [
    CommonModule,
    JobsTableComponent,
    AnnotationPipelineComponent,
    JobCreationComponent,
    SingleAnnotationComponent,
    AllelesTableComponent,
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
  public currentJobId: number = null;
  public hideComponents = false;
  public hideHistory = false;
  public isUserLoggedIn = false;
  public blockCreate: boolean = false;


  public constructor(
      private jobsService: JobsService,
      private userService: UsersService,
      private ngZone: NgZone,
      private socketNotificationsService: SocketNotificationsService,
  ) { }

  public ngOnInit(): void {
    this.setupJobWebSocketConnection();
    this.userService.userData.pipe(
    ).subscribe((userData) => {
      this.isUserLoggedIn = Boolean(userData);
    });
  }


  public ngOnDestroy(): void {
    this.socketNotificationsService.closeConnection();
    this.userService.userData.pipe(
    ).subscribe((userData) => {
      this.isUserLoggedIn = Boolean(userData);
    });
  }


  private setupJobWebSocketConnection(): void {
    this.socketNotificationsService.getJobNotifications().pipe(
    ).subscribe({
      next: (notification: JobNotification) => {
        this.userService.refreshUserData();
        if (notification.jobId === this.currentJobId) {
          this.getCurrentJobDetails(notification.jobId);
        }
        if (this.isUserLoggedIn) {
          this.jobsTableComponent.refreshTable();
        }
      },
      error: err => {
        console.error(err);
      }
    });
  }

  public autoSavePipeline(): void {
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
      if (this.file.type === 'text/vcard') {
        createObservable = this.jobsService.createVcfJob(
          this.file,
          this.pipelineId,
          this.selectedGenome,
        );
      } else {
        createObservable = this.jobsService.createNonVcfJob(
          this.file,
          this.pipelineId,
          this.selectedGenome,
          this.fileSeparator,
          this.fileHeader
        );
      }

      this.blockCreate = true;
      createObservable.pipe(
        take(1),
      ).subscribe({
        next: (jobId: number) => {
          this.isCreationFormVisible = false;
          this.currentJobId = jobId;
        },
        complete: () => {
          this.blockCreate = false;
        },
        error: (err: Error) => {
          this.creationError = err.message;
        }
      });
    }
  }

  private getCurrentJobDetails(jobId: number): void {
    this.jobsService.getJobDetails(jobId).subscribe({
      next: (job: Job) => {
        if (!this.currentJob || this.currentJob.status !== job.status) {
          this.currentJob = job;
          this.downloadLink = this.jobsService.getDownloadJobResultLink(job.id);
        }
      },
      error: (err: Error) => {
        this.creationError = err.message;
      }
    });
  }

  public showCreateMode(): void {
    this.isCreationFormVisible = true;
    this.creationError = '';
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
    this.creationError = '';
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
    return this.blockCreate
      || !this.file
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

  public refreshUserQuota(): void {
    this.userService.refreshUserData();
  }
}

