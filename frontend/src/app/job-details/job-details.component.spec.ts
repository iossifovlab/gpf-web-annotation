import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobDetailsComponent } from './job-details.component';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { Job } from '../job-creation/jobs';

class JobsServiceMock {
  public getJobDetails(jobId: number): Observable<Job> {
    return of(new Job(jobId, new Date('12.12.12'), 'test@email.com', 'success', 2.5));
  }

  public getDownloadJobResultLink(jobId: number): string {
    return `jobs/result/${jobId}`;
  }

  public getJobInputDownloadLink(jobId: number): string {
    return `jobs/input/${jobId}`;
  }

  public getJobConfigLink(jobId: number): string {
    return `jobs/config/${jobId}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public deleteJob(jobId: number): Observable<object> {
    return of({});
  }
}

class MatDialogRefMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public close(value: boolean): void { }
}
describe('JobDetailsComponent', () => {
  let component: JobDetailsComponent;
  let fixture: ComponentFixture<JobDetailsComponent>;
  const jobsServiceMock = new JobsServiceMock();
  const mockMatDialogRef = new MatDialogRefMock();

  beforeEach(() => {
    const mockJobId = 3;

    TestBed.configureTestingModule({
      imports: [JobDetailsComponent, MatDialogModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockJobId },
        { provide: MatDialogRef, useValue: mockMatDialogRef },
        { provide: JobsService, useValue: jobsServiceMock },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(JobDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get job details on init', () => {
    component.ngOnInit();
    expect(component.job).toStrictEqual(new Job(3, new Date('12.12.12'), 'test@email.com', 'success', 2.5));
  });

  it('should get links for all files on init', () => {
    component.ngOnInit();
    expect(component.annotatedFileLink).toBe('jobs/result/3');
    expect(component.uploadedFileLink).toBe('jobs/input/3');
    expect(component.configFileLink).toBe('jobs/config/3');
  });

  it('should get correct css class for status success', () => {
    expect(component.getStatusClass('success')).toBe('success-status');
  });

  it('should delete job and close modal', () => {
    const deleteSpy = jest.spyOn(jobsServiceMock, 'deleteJob');
    const closeSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.onDelete(9);
    expect(deleteSpy).toHaveBeenCalledWith(9);
    expect(closeSpy).toHaveBeenCalledWith(true);
  });
});
