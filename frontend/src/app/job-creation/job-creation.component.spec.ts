import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobCreationComponent } from './job-creation.component';
import { MatDialogRef } from '@angular/material/dialog';
import { JobsService } from './jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';
import { Pipeline } from './pipelines';


class MatDialogRefMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public close(value: boolean): void { }
}

const mockPipelines = [
  new Pipeline('id1', 'content1'),
  new Pipeline('id2', 'content2'),
  new Pipeline('id3', 'content3'),
];
class JobsServiceMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public createJob(file1: File, content: string): Observable<object> {
    return of({});
  }

  public getAnnotationPipelines(): Observable<Pipeline[]> {
    return of(mockPipelines);
  }
}

describe('JobCreationComponent', () => {
  let component: JobCreationComponent;
  let fixture: ComponentFixture<JobCreationComponent>;
  let templateRef: HTMLElement;
  const mockMatDialogRef = new MatDialogRefMock();
  const jobsServiceMock = new JobsServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JobCreationComponent],
      providers: [
        {
          provide: MatDialogRef,
          useValue: mockMatDialogRef
        },
        {
          provide: JobsService,
          useValue: jobsServiceMock
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
    const mockFile = new File([], 'mockFile', { type: 'pdf' });
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    component.onUpload(mockEvent);
    expect(component.uploadError).toBe('Unsupported format!');
  });

  it('should upload csv file', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/csv' });
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    component.onUpload(mockEvent);
    expect(component.uploadError).toBe('');
  });

  it('should upload vcf file', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/vcard' });
    const mockEvent = {
      target: { files: [mockFile] } as unknown as HTMLInputElement,
    } as unknown as Event;

    component.onUpload(mockEvent);
    expect(component.uploadError).toBe('');
  });

  it('should change view to text editor', () => {
    component.view = 'pipeline list';
    component.changeView('text editor');
    expect(component.view).toBe('text editor');
  });

  it('should close modal of job creation on cancel', () => {
    const dialogSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.onCancelClick();
    expect(dialogSpy).toHaveBeenCalledWith(true);
  });

  it('should close modal when creating the process', () => {
    const dialogSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.onCreateClick();
    expect(dialogSpy).toHaveBeenCalledWith(true);
  });

  it('should create process with yml config entered by user', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/vcard' });
    component.file = mockFile;
    component.changeView('text editor');
    fixture.detectChanges();

    component.ymlConfig = 'some yml text';
    const createJob = jest.spyOn(jobsServiceMock, 'createJob');
    component.onCreateClick();
    expect(createJob).toHaveBeenCalledWith(mockFile, null, 'some yml text');
    expect(component.ymlConfig).toBe('');
  });

  it('should create process with pipeline', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/vcard' });
    component.file = mockFile;
    fixture.detectChanges();

    component.onPipelineClick('autism');
    const createJob = jest.spyOn(jobsServiceMock, 'createJob');
    component.onCreateClick();
    expect(createJob).toHaveBeenCalledWith(mockFile, 'autism', null);
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
    component.changeView('text editor');
    fixture.detectChanges();
    const ymlArea: HTMLTextAreaElement = templateRef.querySelector('#yml-textarea');
    ymlArea.value = '';
    expect(component.disableCreate()).toBe(true);
  });

  it('should get pipelines list on component init', () => {
    const getPipelinesSpy = jest.spyOn(jobsServiceMock, 'getAnnotationPipelines');
    component.ngOnInit();
    expect(getPipelinesSpy).toHaveBeenCalledWith();
    expect(component.pipelines).toStrictEqual(mockPipelines);
  });
});
