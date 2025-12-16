import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnnotationWrapperComponent } from './annotation-wrapper.component';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { UserData, UsersService } from '../users.service';
import { SingleAnnotationService } from '../single-annotation.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { FileContent, Job } from '../job-creation/jobs';
import { Pipeline } from '../job-creation/pipelines';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';

class UserServiceMock {
  public userData = new BehaviorSubject<UserData>({
    email: 'email',
    loggedIn: true,
    isAdmin: false,
    limitations: {
      dailyJobs: 5,
      filesize: '64M',
      todayJobsCount: 4,
      variantCount: 1000,
      diskSpace: '1000'
    }
  });
}

const mockPipelines = [
  new Pipeline('id1', 'name1', 'content1', 'default', 'loaded'),
  new Pipeline('id2', 'name2', 'content2', 'default', 'loaded'),
  new Pipeline('id3', 'name3', 'content3', 'default', 'loaded'),
];

const jobs = [
  new Job(1, 1, new Date('1.10.2025'), 'test@email.com', 'success', 3.2, 'fileName1', '12 KB'),
  new Job(2, 2, new Date('1.10.2025'), 'test@email.com', 'failed', 2.7, 'fileName2', '12 KB'),
];
class JobsServiceMock {
  public getJobs(): Observable<Job[]> {
    return of(jobs);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public createVcfJob(file1: File, pipeline: string, content: string, genome: string): Observable<number> {
    return of(2);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @stylistic/max-len
  public createNonVcfJob(file1: File, pipeline: string, config: string, genome: string, fileSeparator: string): Observable<number> {
    return of(1);
  }

  public getAnnotationPipelines(): Observable<Pipeline[]> {
    return of(mockPipelines);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getJobDetails(jobId: number): Observable<Job> {
    return of(jobs.find(j => j.id === jobId));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public submitFile(file: File): Observable<FileContent> {
    return of(new FileContent(',', ['chr', 'pos'], [['1', '123']]));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public submitSeparator(file: File, separator: string): Observable<FileContent> {
    return of(new FileContent(',', ['chr', 'pos'], [['1', '123']]));
  }

  public getDownloadJobResultLink(jobId: string): string {
    return `url/${jobId}`;
  }

  public getSocketNotifications(): Observable<object> {
    return of({});
  }

  public closeConnection(): void { }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
(global as any).ResizeObserver = class {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
};

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
        provideHttpClient(),
        provideMonacoEditor()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationWrapperComponent);
    component = fixture.componentInstance;
    component.currentView = 'jobs';

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

    component.autoSavePipeline();
    expect(component.isCreationFormVisible).toBe(false);
  });

  it('should show creation job form and reset file', () => {
    component.isCreationFormVisible = false;
    component.showCreateMode();
    expect(component.isCreationFormVisible).toBe(true);
    expect(component.currentJob).toBeNull();
    expect(component.downloadLink).toBe('');
    expect(component.file).toBeNull();
  });

  it('should auto save and get annonymous pipeline name', () => {
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave')
      .mockReturnValue(of('annonymous pipeline'));
    component.autoSavePipeline();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
    expect(component.pipelineId).toBe('annonymous pipeline');
  });

  it('should auto save pipeline', () => {
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave')
      .mockReturnValue(of(null));

    component.autoSavePipeline();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
    expect(component.pipelineId).toBe('id1');
  });

  it('should create job with vcf file', () => {
    component.file = new File([], 'mock.vcf', { type: 'text/vcard' });
    component.pipelineId = 'pipeline';
    component.selectedGenome = 'hg38';
    component.fileSeparator = '';
    component.fileHeader = null;
    const createJobSpy = jest.spyOn(jobsServiceMock, 'createVcfJob');

    component.autoSavePipeline();

    expect(createJobSpy).toHaveBeenCalledWith(
      new File([], 'mock.vcf'),
      'pipeline',
      'hg38',
    );
    expect(component.creationError).toBe('');
    expect(component.currentJobId).toBe(2);
  });

  it('should create job with csv file', () => {
    component.file = new File([], 'mock.csv', { type: 'text/comma-separated-values' });
    component.pipelineId = 'pipeline';
    component.selectedGenome = 'hg38';
    component.fileSeparator = ',';
    component.fileHeader = new Map<string, string>([['a', '1']]);
    const createJobSpy = jest.spyOn(jobsServiceMock, 'createNonVcfJob');

    component.autoSavePipeline();

    expect(createJobSpy).toHaveBeenCalledWith(
      new File([], 'mock.csv'),
      'pipeline',
      'hg38',
      ',',
      new Map<string, string>([['a', '1']])
    );
    expect(component.creationError).toBe('');
    expect(component.currentJobId).toBe(1);
  });
});
