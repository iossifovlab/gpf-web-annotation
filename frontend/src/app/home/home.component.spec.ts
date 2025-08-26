import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Job } from '../job-creation/jobs';
import { HomeComponent } from './home.component';
import { Observable } from 'rxjs/internal/Observable';
import { of } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';

const jobs = [
  new Job(1, '1.10.2025', 'test@email.com', 'in process'),
  new Job(2, '1.10.2025', 'test@email.com', 'failed'),
];
class JobsServiceMock {
  public getJobs(): Observable<Job[]> {
    return of(jobs);
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
});
