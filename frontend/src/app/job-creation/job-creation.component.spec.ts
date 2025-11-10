import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobCreationComponent } from './job-creation.component';
import { JobsService } from './jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';
import { Pipeline } from './pipelines';
import { FileContent } from './jobs';
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
  public submitSeparator(file: File, separator: string): Observable<FileContent> {
    return of(new FileContent(',', ['chr', 'pos'], [['1', '123']]));
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

describe('JobCreationComponent', () => {
  let component: JobCreationComponent;
  let fixture: ComponentFixture<JobCreationComponent>;
  let templateRef: HTMLElement;
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

    fixture = TestBed.createComponent(JobCreationComponent);
    component = fixture.componentInstance;
    templateRef = fixture.debugElement.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should remove uploaded file', () => {
    const fileBlock = templateRef.querySelector('#uploaded-file-container');
    component.file = new File([], 'mockFile');

    component.removeFile();

    expect(component.file).toBeNull();
    expect(fileBlock).toBeNull();
  });

  it('should upload file', () => {
    const mockFile = new File([], 'mockFile');
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    component.onUpload(mockEvent);
    expect(component.file).toBe(mockFile);
  });

  it('should show error message on file format validation', () => {
    const mockFile = new File([], 'mockFile.pdf');
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    component.onUpload(mockEvent);
    expect(component.uploadError).toBe('Unsupported format!');
  });

  it('should upload csv file and sent query for preview', () => {
    const mockFile = new File([], 'mockFile.csv');
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    const submitFileSpy = jest.spyOn(jobsServiceMock, 'submitFile');
    component.onUpload(mockEvent);
    expect(submitFileSpy).toHaveBeenCalledWith(mockFile);
    expect(component.uploadError).toBe('');
  });

  it('should upload vcf file', () => {
    const mockFile = new File([], 'mockFile.vcf');
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    component.onUpload(mockEvent);
    expect(component.uploadError).toBe('');
  });

  it('should get pipeline and invoke the correct create job method when uploaded file is non vcf', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/csv' });
    component.file = mockFile;
    component.fileSeparator = '\t';
    component.updatedFileHeader = new Map([['pos', 'POS']]);
    component.pipelineId = 'autism';
    fixture.detectChanges();

    const createVcfJob = jest.spyOn(jobsServiceMock, 'createNonVcfJob');
    component.onCreateClick();
    expect(createVcfJob).toHaveBeenCalledWith(
      mockFile,
      'autism',
      null,
      'hg38',
      '\t',
      new Map([['pos', 'POS']])
    );
  });

  it('should disable Create button if no file is uploaded', () => {
    component.file = null;
    component.uploadError = '';
    component.pipelineId = 'autism';
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable Create button if file with unsupported format is uploaded', () => {
    const mockFile = new File([], 'mockFile', { type: 'json' });
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    component.onUpload(mockEvent);
    component.pipelineId = 'autism';
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable Create button if no pipeline is chosen', () => {
    component.file = new File([], 'mockFile', { type: 'json' });
    component.uploadError = '';
    component.pipelineId = '';
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable Create button if no yml config is set', () => {
    component.file = new File([], 'mockFile', { type: 'json' });
    component.uploadError = '';
    component.view = 'text editor';
    component.ymlConfig = '';
    expect(component.disableCreate()).toBe(true);
  });

  it('should disable Create button if yml config is invalid', () => {
    component.isConfigValid = false;
    expect(component.disableCreate()).toBe(true);
  });

  it('should create process with yml config entered by user', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/vcard' });
    component.file = mockFile;
    component.view = 'text editor';
    fixture.detectChanges();

    component.ymlConfig = 'some yml text';
    const createVcfJob = jest.spyOn(jobsServiceMock, 'createVcfJob');
    component.onCreateClick();
    expect(createVcfJob).toHaveBeenCalledWith(mockFile, null, 'some yml text', 'hg38');
    expect(component.ymlConfig).toBe('');
  });

  it('should create process with pipeline', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/vcard' });
    component.file = mockFile;
    fixture.detectChanges();

    component.pipelineId = 'autism';
    const createVcfJob = jest.spyOn(jobsServiceMock, 'createVcfJob');
    component.onCreateClick();
    expect(createVcfJob).toHaveBeenCalledWith(mockFile, 'autism', null, 'hg38');
  });

  it('should type config and invoke the correct create job method when uploaded file is non vcf', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/csv' });
    component.file = mockFile;
    component.fileSeparator = '\t';
    component.updatedFileHeader = new Map([['chr', 'CHROM']]);
    component.view = 'text editor';
    fixture.detectChanges();

    component.ymlConfig = 'some yml text';
    const createVcfJob = jest.spyOn(jobsServiceMock, 'createNonVcfJob');
    component.onCreateClick();
    expect(createVcfJob).toHaveBeenCalledWith(
      mockFile,
      null,
      'some yml text',
      'hg38',
      '\t',
      new Map([['chr', 'CHROM']])
    );
    expect(component.ymlConfig).toBe('');
  });

  it('should prevent default behavior if event and set file when csv file is dropped', () => {
    const mockFile = new File([], 'mockFile.csv');
    const mockDataTransfer = { files: [mockFile] } as unknown as DataTransfer;
    const mockEvent = { dataTransfer: mockDataTransfer, preventDefault: jest.fn() } as unknown as DragEvent;

    component.onDropSuccess(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalledWith();
    expect(component.file).toBe(mockFile);
    expect(component.uploadError).toBe('');
  });

  it('should prevent default and set uploadError for unsupported format on drop', () => {
    const mockFile = new File([], 'mockFile', { type: 'application/pdf' });
    const mockDataTransfer = { files: [mockFile] } as unknown as DataTransfer;
    const mockEvent = { dataTransfer: mockDataTransfer, preventDefault: jest.fn() } as unknown as DragEvent;

    component.onDropSuccess(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalledWith();
    expect(component.file).toBe(mockFile);
    expect(component.uploadError).toBe('Unsupported format!');
  });

  it('should prevent default and do nothing if no files are dropped', () => {
    const mockDataTransfer = { files: [] } as unknown as DataTransfer;
    const mockEvent = { dataTransfer: mockDataTransfer, preventDefault: jest.fn() } as unknown as DragEvent;

    component.file = null;
    component.uploadError = '';
    component.onDropSuccess(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalledWith();
    expect(component.file).toBeNull();
    expect(component.uploadError).toBe('');
  });

  it('should submit new separator', () => {
    const submitSeparatorSpy = jest.spyOn(jobsServiceMock, 'submitSeparator');

    component.file = new File([], 'mockFile');
    component.fileSeparator = '!';
    component.submitNewSeparator(',');

    expect(submitSeparatorSpy).toHaveBeenCalledWith(new File([], 'mockFile'), ',');
    expect(component.fileContent).toStrictEqual(new FileContent(',', ['chr', 'pos'], [['1', '123']]));
    expect(component.fileSeparator).toBe(',');
  });
});
