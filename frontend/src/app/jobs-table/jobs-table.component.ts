import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { MatDialog } from '@angular/material/dialog';
import { JobsService } from '../job-creation/jobs.service';
import { repeat, Subscription, take, takeWhile } from 'rxjs';
import { FileContent, getStatusClassName, Job } from '../job-creation/jobs';
import { JobDetailsComponent } from '../job-details/job-details.component';
import { ColumnSpecifyingModalComponent } from '../column-specifying-modal/column-specifying-modal.component';

@Component({
  selector: 'app-jobs-table',
  imports: [CommonModule],
  templateUrl: './jobs-table.component.html',
  styleUrl: './jobs-table.component.css'
})
export class JobsTableComponent implements OnInit, OnDestroy {
  public jobs: Job[] = [];
  private refreshJobsSubscription = new Subscription();

  public constructor(private dialog: MatDialog, private jobsService: JobsService) {}

  public ngOnInit(): void {
    this.getJobs();
    this.refreshTable();
  }

  private areJobsFinished(): boolean {
    return !this.jobs.find(j => j.status !== 'success' && j.status !== 'failed');
  }

  public openCreateModal(): void {
    const createModalRef = this.dialog.open(JobCreationComponent, {
      height: '60vh',
      width: '50vw',
      maxWidth: '1000px',
      minHeight: '400px'
    });

    createModalRef.afterClosed().subscribe((result: {isCanceled: boolean, fileContent: FileContent}) => {
      if (!result) {
        return;
      }
      if (!result.isCanceled) {
        this.refreshTable();
      }
      if (result.fileContent) {
        this.openColumnMappingModal(result.fileContent);
      }
    });
  }

  public getModalContent(jobId: number): void {
    this.jobsService.getFileData(jobId).pipe(take(1)).subscribe(data =>
      this.openColumnMappingModal(data)
    );
  }

  public openColumnMappingModal(content: FileContent): void {
    const specifyColumnModalRef = this.dialog.open(ColumnSpecifyingModalComponent, {
      data: content,
      height: 'fit-content',
      width: '50vw',
      minHeight: '300px',
      maxHeight: '1000px',
      maxWidth: '1000px'
    });

    specifyColumnModalRef.afterClosed().subscribe(areColumnsSubmitted => {
      if (areColumnsSubmitted) {
        this.refreshTable();
      }
    });
  }

  private refreshTable(): void {
    this.refreshJobsSubscription.unsubscribe();
    this.refreshJobsSubscription = this.jobsService.getJobs().pipe(
      repeat({ delay: 30000 }),
      takeWhile(jobs => !this.areJobsFinished() || jobs.length !== this.jobs.length),
    ).subscribe(jobs => {
      this.jobs = jobs.reverse();
    });
  }

  private getJobs(): void {
    this.jobsService.getJobs().pipe(take(1)).subscribe(jobs => {
      this.jobs = jobs.reverse();
    });
  }

  public openDetailsModal(jobId: number): void {
    const detailsModalRef = this.dialog.open(JobDetailsComponent, {
      data: jobId,
      height: '40vh',
      width: '30vw',
      maxWidth: '1000px',
      minHeight: '400px'
    });

    detailsModalRef.afterClosed().subscribe(isJobDeleted => {
      if (isJobDeleted) {
        this.refreshTable();
      }
    });
  }

  public getDownloadLink(jobId: number): string {
    return this.jobsService.getDownloadJobResultLink(jobId);
  }

  public getStatusClass(status: string): string {
    return getStatusClassName(status);
  }

  public onDelete(jobId: number): void {
    this.jobsService.deleteJob(jobId).subscribe(() => this.getJobs());
  }

  public ngOnDestroy(): void {
    this.refreshJobsSubscription.unsubscribe();
  }
}
