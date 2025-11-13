import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnnotationWrapperComponent } from './annotation-wrapper.component';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { UsersService } from '../users.service';
import { SingleAnnotationService } from '../single-annotation.service';
import { Observable, of } from 'rxjs';
import { FileContent, Job } from '../job-creation/jobs';
import { Pipeline } from '../job-creation/pipelines';

class UserServiceMock {
  public userData = {
    value: {
      limitations: {
        dailyJobs: 5,
        filesize: '64M',
        jobsLeft: 4,
        variantCount: 1000,
      }
    }
  };
}

const mockPipelines = [
  new Pipeline('id1', 'content1', 'default'),
  new Pipeline('id2', 'content2', 'default'),
  new Pipeline('id3', 'content3', 'default'),
];

const jobs = [
  new Job(1, 1, new Date('1.10.2025'), 'test@email.com', 'in process', 3.2, 'fileName'),
  new Job(2, 2, new Date('1.10.2025'), 'test@email.com', 'failed', 2.7, 'fileName'),
];
class JobsServiceMock {
  public getJobs(): Observable<Job[]> {
    return of(jobs);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public createVcfJob(file1: File, pipeline: string, content: string, genome: string): Observable<object> {
    return of({});
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @stylistic/max-len
  public createNonVcfJob(file1: File, pipeline: string, config: string, genome: string, fileSeparator: string): Observable<object> {
    return of({});
  }

  public getAnnotationPipelines(): Observable<Pipeline[]> {
    return of(mockPipelines);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public submitFile(file: File): Observable<FileContent> {
    return of(new FileContent(',', ['chr', 'pos'], [['1', '123']]));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public submitSeparator(file: File, separator: string): Observable<FileContent> {
    return of(new FileContent(',', ['chr', 'pos'], [['1', '123']]));
  }
}

describe('AnnotationWrapperComponent', () => {
  let component: AnnotationWrapperComponent;
  let fixture: ComponentFixture<AnnotationWrapperComponent>;
  const jobsServiceMock = new JobsServiceMock();
  const userServiceMock = new UserServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AnnotationWrapperComponent],
      providers: [
        JobsService,
        {
          provide: UsersService,
          useValue: userServiceMock
        },
        {
          provide: JobsService,
          useValue: jobsServiceMock
        },
        SingleAnnotationService,
        provideHttpClient()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationWrapperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should disable Create button if no file is uploaded', () => {
    component.file = null;
    component.pipelineId = 'autism';
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable Create button if yml config is invalid', () => {
    component.isConfigValid = false;
    expect(component.disableCreate()).toBe(true);
  });

  it('should hide creation form after creating a job', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/vcard' });
    component.file = mockFile;
    component.selectedGenome = 'hg38';
    component.pipelineId = 'autism';
    component.isCreationFormVisible = true;

    component.onCreateClick();
    expect(component.isCreationFormVisible).toBe(false);
  });

  it('should show creation job form and reset pipelines state', () => {
    component.isCreationFormVisible = false;
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'resetState');
    component.showCreateMode();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
  });

  it('should reset state when resetting the creation process', () => {
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'resetState');
    const createJobComponentSpy = jest.spyOn(component.createJobComponent, 'removeFile');
    component.creationError = 'some error';
    component.onResetClick();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
    expect(createJobComponentSpy).toHaveBeenCalledWith();
    expect(component.creationError).toBe('');
  });
});
