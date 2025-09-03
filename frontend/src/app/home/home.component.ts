import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { MatDialog } from '@angular/material/dialog';
import { JobsService } from '../job-creation/jobs.service';
import { repeat, Subscription, take, takeWhile } from 'rxjs';
import { getStatusClassName, Job } from '../job-creation/jobs';
import { JobDetailsComponent } from '../job-details/job-details.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
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
    });

    createModalRef.afterClosed().subscribe(() => {
      this.refreshTable();
    });
  }

  private refreshTable(): void {
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
    this.dialog.open(JobDetailsComponent, {
      data: jobId,
      height: '40vh',
      width: '30vw',
    });
  }

  public getDownloadLink(jobId: number): string {
    return this.jobsService.getDownloadJobResultLink(jobId);
  }

  public getStatusClass(status: string): string {
    return getStatusClassName(status);
  }

  public ngOnDestroy(): void {
    this.refreshJobsSubscription.unsubscribe();
  }
}
