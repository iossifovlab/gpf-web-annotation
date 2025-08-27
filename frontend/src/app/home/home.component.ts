import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { MatDialog } from '@angular/material/dialog';
import { JobsService } from '../job-creation/jobs.service';
import { take } from 'rxjs';
import { Job } from '../job-creation/jobs';
import { JobDetailsComponent } from '../job-details/job-details.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  public jobs: Job[] = [];

  public constructor(private dialog: MatDialog, private jobsService: JobsService) {}

  public ngOnInit(): void {
    this.jobsService.getJobs().pipe(take(1)).subscribe(jobs => {
      this.jobs = jobs;
    });
  }

  public openCreateModal(): void {
    this.dialog.open(JobCreationComponent, {
      height: '60vh',
      width: '50vw',
    });
  }

  public openDetailsModal(jobId: number): void {
    this.dialog.open(JobDetailsComponent, {
      data: jobId,
      height: '60vh',
      width: '50vw',
    });
  }

  public getDownloadLink(jobId: number): string {
    return this.jobsService.getDownloadJobResultLink(jobId);
  }
}
