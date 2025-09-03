import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Job } from '../job-creation/jobs';
import { HomeComponent } from './home.component';
import { Observable } from 'rxjs/internal/Observable';
import { of } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';

const jobs = [
  new Job(1, new Date('1.10.2025'), 'test@email.com', 'in process'),
  new Job(2, new Date('1.10.2025'), 'test@email.com', 'failed'),
];
class JobsServiceMock {
  public getJobs(): Observable<Job[]> {
    return of(jobs);
  }

  public getDownloadJobResultLink(jobId: number): string {
    return `/jobs/mockUrl/${jobId}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public deleteJob(id: number): Observable<object> {
    return of({});
  }
}

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  const jobsServiceMock = new JobsServiceMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: JobsService, useValue: jobsServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get users jobs from service', () => {
    component.ngOnInit();
    expect(component.jobs).toStrictEqual(jobs);
  });

  it('should get download link for annotated file from service', () => {
    const url = component.getDownloadLink(15);
    expect(url).toBe('/jobs/mockUrl/15');
  });

  it('should call delete job from service and get list of jobs after deletion is ready', () => {
    const deleteSpy = jest.spyOn(jobsServiceMock, 'deleteJob');
    const getJobsSpy = jest.spyOn(jobsServiceMock, 'getJobs');
    component.onDelete(12);
    expect(deleteSpy).toHaveBeenCalledWith(12);
    expect(getJobsSpy).toHaveBeenCalledWith();
  });
});
