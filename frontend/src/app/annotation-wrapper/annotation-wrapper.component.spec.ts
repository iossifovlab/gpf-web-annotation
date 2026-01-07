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
import { SocketNotificationsService } from '../socket-notifications/socket-notifications.service';
import { JobNotification, PipelineNotification } from '../socket-notifications/socket-notifications';
import { AnnotationPipelineService } from '../annotation-pipeline.service';

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

  public refreshUserData(): void { }
}

const mockPipelines = [
  new Pipeline('id1', 'name1', 'content1', 'default', 'loaded'),
  new Pipeline('id2', 'name2', 'content2', 'default', 'loaded'),
  new Pipeline('id3', 'name3', 'content3', 'default', 'loaded'),
];

const jobs = [
  new Job(1, 1, new Date('1.10.2025'), 'test@email.com', 'success', 3.2, 'fileName1', '12 KB', ''),
  new Job(2, 2, new Date('1.10.2025'), 'test@email.com', 'failed', 2.7, 'fileName2', '12 KB', ''),
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

class SocketNotificationsServiceMock {
  public getPipelineNotifications(): Observable<PipelineNotification> {
    return of(null);
  }

  public getJobNotifications(): Observable<JobNotification> {
    return of(new JobNotification(1, 'failed'));
  }

  public closeConnection(): void { }
}

class AnnotationPipelineServiceMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public loadPipeline(name: string): Observable<void> {
    return of();
  }
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
  const socketNotificationsServiceMock = new SocketNotificationsServiceMock();
  const annotationPipelineServiceMock = new AnnotationPipelineServiceMock();

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
        {
          provide: SocketNotificationsService,
          useValue: socketNotificationsServiceMock
        },
        {
          provide: AnnotationPipelineService,
          useValue: annotationPipelineServiceMock
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

  it('should check if user is logged in on component init', () => {
    component.ngOnInit();
    expect(component.isUserLoggedIn).toBe(true);
  });

  it('should set up web socket communication on component init', () => {
    const getSocketNotificationSpy = jest.spyOn(socketNotificationsServiceMock, 'getJobNotifications');
    const refreshUserDataSpy = jest.spyOn(userServiceMock, 'refreshUserData');
    const refreshJobsTableSpy = jest.spyOn(component.jobsTableComponent, 'refreshTable');
    component.currentJobId = 1;
    component.isUserLoggedIn = true;
    component.ngOnInit();
    expect(getSocketNotificationSpy).toHaveBeenCalledWith();
    expect(refreshUserDataSpy).toHaveBeenCalledWith();
    expect(refreshJobsTableSpy).toHaveBeenCalledWith();
  });

  it('should get job details when setting up web socket communication', () => {
    const getJobDetailsSpy = jest.spyOn(jobsServiceMock, 'getJobDetails');

    component.currentJobId = 1;
    component.isUserLoggedIn = true;
    component.currentJob = new Job(123, 1, null, 'user1', 'in process', 12, 'fileName', '12K', '');
    component.ngOnInit();
    expect(getJobDetailsSpy).toHaveBeenCalledWith(1);
    expect(component.currentJob).toStrictEqual(jobs[1]);
    expect(component.downloadLink).toBe('url/1');
  });

  it('should close socket connection on destroy', () => {
    const closeConnectionSpy = jest.spyOn(socketNotificationsServiceMock, 'closeConnection');
    component.ngOnDestroy();
    expect(closeConnectionSpy).toHaveBeenCalledWith();
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

  it('should not trigger auto save pipeline when editor is empty', () => {
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave');
    component.pipelinesComponent.currentPipelineText = '';

    component.autoSavePipeline();
    expect(pipelinesComponentSpy).not.toHaveBeenCalledWith();
  });

  it('should create job with vcf file and auto save pipeline', () => {
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
    expect(component.currentJob).toStrictEqual(jobs[1]);
  });

  it('should create job with csv file and auto save pipeline', () => {
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

  it('should trigger allele annotation and auto save pipeline', () => {
    component.currentView = 'single allele';
    fixture.detectChanges();

    component.pipelineId = 'pipeline';
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave').mockReturnValue(of(''));
    const annotateAlleleSpy = jest.spyOn(component.singleAnnotationComponent, 'annotateAllele');

    component.autoSavePipeline();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
    expect(annotateAlleleSpy).toHaveBeenCalledWith();
  });

  it('should trigger allele annotation when catching emits from alleles table', () => {
    component.currentView = 'single allele';
    fixture.detectChanges();

    const autoSavePipelineSpy = jest.spyOn(component, 'autoSavePipeline');
    const setAlleleSpy = jest.spyOn(component.singleAnnotationComponent, 'setAllele');

    component.triggerSingleAlleleAnnotation('chr1 123123 TT GG');
    expect(autoSavePipelineSpy).toHaveBeenCalledWith();
    expect(setAlleleSpy).toHaveBeenCalledWith('chr1 123123 TT GG');
  });

  it('should set and load pipeline when catching emits from pipeline component', () => {
    component.pipelineId = 'prev_pipeline';
    const loadPipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'loadPipeline');
    const resetSingleAlleleReportSpy = jest.spyOn(component, 'resetSingleAlleleReport');
    const disableCreateSpy = jest.spyOn(component, 'disableCreate');

    component.setPipeline('pipeline_autism');
    expect(resetSingleAlleleReportSpy).toHaveBeenCalledWith();
    expect(component.pipelineId).toBe('pipeline_autism');
    expect(loadPipelineSpy).toHaveBeenCalledWith('pipeline_autism');
    expect(disableCreateSpy).toHaveBeenCalledWith();
  });

  it('should trigger annotation report reset on pipeline change', () => {
    component.currentView = 'single allele';
    fixture.detectChanges();

    const resetReportSpy = jest.spyOn(component.singleAnnotationComponent, 'resetReport');

    component.resetSingleAlleleReport();
    expect(resetReportSpy).toHaveBeenCalledWith();
  });

  it('should not trigger any changes when selecting the same pipeline', () => {
    component.pipelineId = 'pipeline_autism';
    const resetSingleAlleleReportSpy = jest.spyOn(component, 'resetSingleAlleleReport');

    component.setPipeline('pipeline_autism');
    expect(resetSingleAlleleReportSpy).not.toHaveBeenCalledWith();
  });

  it('should set genome', () => {
    component.selectedGenome = 'hg19';
    component.setGenome('hg38');
    expect(component.selectedGenome).toBe('hg38');
  });

  it('should set pipeline config state', () => {
    component.isConfigValid = true;
    const resetSingleAlleleReportSpy = jest.spyOn(component, 'resetSingleAlleleReport');
    const disableCreateSpy = jest.spyOn(component, 'disableCreate');
    component.setConfigValid(true);
    expect(resetSingleAlleleReportSpy).not.toHaveBeenCalledWith();
    expect(disableCreateSpy).not.toHaveBeenCalledWith();

    component.setConfigValid(false);
    expect(component.isConfigValid).toBe(false);
    expect(resetSingleAlleleReportSpy).toHaveBeenCalledWith();
    expect(disableCreateSpy).toHaveBeenCalledWith();
  });

  it('should set job\'s file', () => {
    component.file = null;
    component.creationError = 'some error';
    const disableCreateSpy = jest.spyOn(component, 'disableCreate');
    const mockFile = new File([], 'mockFile');
    component.setFile(mockFile);
    expect(component.file).toStrictEqual(mockFile);
    expect(disableCreateSpy).toHaveBeenCalledWith();
  });

  it('should set file separator', () => {
    component.fileSeparator = null;
    component.setFileSeparator('\t');
    expect(component.fileSeparator).toBe('\t');
  });

  it('should set the new headers of the file', () => {
    const newHeader = new Map<string, string>([['chr', 'CHR']]);
    const disableCreateSpy = jest.spyOn(component, 'disableCreate');

    component.setUpdatedFileHeader(newHeader);
    expect(component.fileHeader).toStrictEqual(newHeader);
    expect(disableCreateSpy).toHaveBeenCalledWith();
  });

  it('should check if genome is required and not selected', () => {
    component.fileHeader = new Map<string, string>([['location', 'LOC']]);
    component.selectedGenome = '';
    expect(component.isGenomeValid()).toBe(false);

    component.fileHeader = new Map<string, string>([['location', 'LOC']]);
    component.selectedGenome = 'hg38';
    expect(component.isGenomeValid()).toBe(true);

    component.fileHeader = new Map<string, string>([['chr', 'CHR']]);
    component.selectedGenome = '';
    expect(component.isGenomeValid()).toBe(true);
  });

  it('should get css class names of different job statuses', () => {
    component.currentJob = new Job(123, 1, null, 'user1', 'in process', 12, 'fileName', '12K', '');
    expect(component.getStatusClass()).toBe('in-progress-status');

    component.currentJob = new Job(123, 1, null, 'user1', 'waiting', 12, 'fileName', '12K', '');
    expect(component.getStatusClass()).toBe('waiting-status');

    component.currentJob = new Job(123, 1, null, 'user1', 'success', 12, 'fileName', '12K', '');
    expect(component.getStatusClass()).toBe('success-status');

    component.currentJob = new Job(123, 1, null, 'user1', 'failed', 12, 'fileName', '12K', '');
    expect(component.getStatusClass()).toBe('fail-status');
  });

  it('should disable create job button', () => {
    component.blockCreate = true;
    component.pipelineId = 'pipeline_autism';
    component.file = new File([], 'mockFile', { type: 'text/vcard' });
    component.selectedGenome = 'hg38';
    component.isConfigValid = true;
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable create job button when no pipeline is selected', () => {
    component.blockCreate = false;
    component.pipelineId = '';
    component.file = new File([], 'mockFile', { type: 'text/vcard' });
    component.selectedGenome = 'hg38';
    component.isConfigValid = true;
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable create job button when no file is uploaded', () => {
    component.blockCreate = false;
    component.pipelineId = 'pipeline_autism';
    component.file = null;
    component.selectedGenome = 'hg38';
    component.isConfigValid = true;
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable create job button when no genome is selected when required', () => {
    component.blockCreate = false;
    component.pipelineId = 'pipeline_autism';
    component.file = new File([], 'mockFile', { type: 'text/comma-separated-values' });
    component.fileHeader = new Map<string, string>([['location', 'LOC']]);
    component.selectedGenome = '';
    component.isConfigValid = true;
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable create job button when no new columns are selected', () => {
    component.blockCreate = false;
    component.pipelineId = 'pipeline_autism';
    component.file = new File([], 'mockFile', { type: 'text/comma-separated-values' });
    component.fileHeader = null;
    component.isConfigValid = true;
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable create job button when pipeline config is not valid', () => {
    component.blockCreate = false;
    component.pipelineId = 'pipeline_autism';
    component.file = new File([], 'mockFile', { type: 'text/vcard' });
    component.selectedGenome = 'hg38';
    component.isConfigValid = false;
    expect(component.disableCreate()).toBe(true);
  });

  it('should check if job is finished', () => {
    expect(component.isJobFinished('success')).toBe(true);
    expect(component.isJobFinished('failed')).toBe(true);
    expect(component.isJobFinished('in process')).toBe(false);
    expect(component.isJobFinished('waiting')).toBe(false);
  });

  it('should switch to single annotation view', () => {
    const showCreateModeSpy = jest.spyOn(component, 'showCreateMode');
    const resetStateSpy = jest.spyOn(component.createJobComponent, 'resetState');
    component.isCreationFormVisible = true;

    component.switchView('single allele');
    expect(showCreateModeSpy).toHaveBeenCalledWith();
    expect(resetStateSpy).toHaveBeenCalledWith();
    expect(component.currentView).toBe('single allele');
  });

  it('should switch to jobs view and reset single annotation result', () => {
    component.currentView = 'single allele';
    fixture.detectChanges();

    const resetSingleAlleleReportSpy = jest.spyOn(component, 'resetSingleAlleleReport');

    component.switchView('jobs');
    expect(resetSingleAlleleReportSpy).toHaveBeenCalledWith();
    expect(component.currentView).toBe('jobs');
  });

  it('should not trigger any changes if the current view is selected', () => {
    const showCreateModeSpy = jest.spyOn(component, 'showCreateMode');
    const resetStateSpy = jest.spyOn(component.createJobComponent, 'resetState');
    component.isCreationFormVisible = true;

    component.switchView('jobs');
    expect(showCreateModeSpy).not.toHaveBeenCalledWith();
    expect(resetStateSpy).not.toHaveBeenCalledWith();
  });

  it('should trigger alleles table refresh', () => {
    component.currentView = 'single allele';
    fixture.detectChanges();
    const refreshTableSpy = jest.spyOn(component.allelesTableComponent, 'refreshTable');

    component.refreshAllelesTable();
    expect(refreshTableSpy).toHaveBeenCalledWith();
  });

  it('should display hidden components and trigger shrinking the editor\'s size', () => {
    const updateComponentsVisibilitySpy = jest.spyOn(component, 'updateComponentsVisibility');
    const shrinkTextareaSpy = jest.spyOn(component.pipelinesComponent, 'shrinkTextarea');

    component.showComponents();
    expect(updateComponentsVisibilitySpy).toHaveBeenCalledWith(false);
    expect(shrinkTextareaSpy).toHaveBeenCalledWith();
  });

  it('should trigger user data refresh on job deletion', () => {
    const refreshUserDataSpy = jest.spyOn(userServiceMock, 'refreshUserData');
    component.refreshUserQuota();
    expect(refreshUserDataSpy).toHaveBeenCalledWith();
  });
});
