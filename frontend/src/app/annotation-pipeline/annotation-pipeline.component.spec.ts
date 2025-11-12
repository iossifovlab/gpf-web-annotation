import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnotationPipelineComponent } from './annotation-pipeline.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { FileContent } from '../job-creation/jobs';
import { JobsService } from '../job-creation/jobs.service';
import { Pipeline } from '../job-creation/pipelines';
import { SingleAnnotationService } from '../single-annotation.service';
import { UsersService } from '../users.service';

class SingleAnnotationServiceMock {
  public getGenomes(): Observable<string[]> {
    return of(['hg38', 'hg19']);
  }
}

const mockPipelines = [
  new Pipeline('id1', 'content1'),
  new Pipeline('id2', 'content2'),
  new Pipeline('id3', 'content3'),
];
class JobsServiceMock {
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
  public validateJobConfig(config: string): Observable<string> {
    return of('');
  }
}

class UserServiceMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

describe('AnnotationPipelineComponent', () => {
  let component: AnnotationPipelineComponent;
  let fixture: ComponentFixture<AnnotationPipelineComponent>;
  const jobsServiceMock = new JobsServiceMock();
  const singleAnnotationServiceMock = new SingleAnnotationServiceMock();
  const userServiceMock = new UserServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JobCreationComponent],
      providers: [
        {
          provide: JobsService,
          useValue: jobsServiceMock
        },
        {
          provide: SingleAnnotationService,
          useValue: singleAnnotationServiceMock
        },
        {
          provide: UsersService,
          useValue: userServiceMock
        },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationPipelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get pipelines list on component init', () => {
    const getPipelinesSpy = jest.spyOn(jobsServiceMock, 'getAnnotationPipelines');
    component.ngOnInit();
    expect(getPipelinesSpy).toHaveBeenCalledWith();
    expect(component.pipelines).toStrictEqual(mockPipelines);
  });

  it('should change view to text editor, clear state and emit to parent', () => {
    const emitViewSpy = jest.spyOn(component.emitView, 'emit');
    const emitConfigSpy = jest.spyOn(component.emitConfig, 'emit');
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');

    component.pipelineId = 'autism';
    component.view = 'pipeline list';
    component.changeView('text editor');
    expect(component.pipelineId).toBe('');
    expect(emitViewSpy).toHaveBeenCalledWith('text editor');
    expect(emitConfigSpy).toHaveBeenCalledWith('');
    expect(emitPipelineIdSpy).toHaveBeenCalledWith('');
  });

  it('should change view to pipeline list, clear state and emit to parent', () => {
    const emitViewSpy = jest.spyOn(component.emitView, 'emit');
    const emitConfigSpy = jest.spyOn(component.emitConfig, 'emit');
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');

    component.ymlConfig = 'config';
    component.view = 'text editor';
    component.changeView('pipeline list');
    expect(component.ymlConfig).toBe('');
    expect(emitViewSpy).toHaveBeenCalledWith('pipeline list');
    expect(emitConfigSpy).toHaveBeenCalledWith('');
    expect(emitPipelineIdSpy).toHaveBeenCalledWith('');
  });

  it('should select new pipeline and emit to parent', () => {
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');
    component.onPipelineClick('other pipeline');
    expect(component.pipelineId).toBe('other pipeline');
    expect(emitPipelineIdSpy).toHaveBeenCalledWith('other pipeline');
  });

  it('should success config validation', () => {
    const emitConfigSpy = jest.spyOn(component.emitConfig, 'emit');
    const emitIsConfigValid = jest.spyOn(component.emitIsConfigValid, 'emit');

    const configValidationSpy = jest.spyOn(jobsServiceMock, 'validateJobConfig');
    component.isConfigValid('config content');
    expect(configValidationSpy).toHaveBeenCalledWith('config content');
    expect(component.configError).toBe('');
    expect(emitConfigSpy).toHaveBeenCalledWith('config content');
    expect(emitIsConfigValid).toHaveBeenCalledWith(true);
  });

  it('should fail config validation', () => {
    const emitConfigSpy = jest.spyOn(component.emitConfig, 'emit');
    const emitIsConfigValid = jest.spyOn(component.emitIsConfigValid, 'emit');

    const configValidationSpy = jest.spyOn(jobsServiceMock, 'validateJobConfig').mockReturnValue(of('error message'));
    component.isConfigValid('config content');
    expect(configValidationSpy).toHaveBeenCalledWith('config content');
    expect(component.configError).toBe('error message');
    expect(emitConfigSpy).not.toHaveBeenCalledWith();
    expect(emitIsConfigValid).toHaveBeenCalledWith(false);
  });
});
