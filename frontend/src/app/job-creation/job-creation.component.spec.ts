import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobCreationComponent } from './job-creation.component';
import { MatDialogRef } from '@angular/material/dialog';
import { JobsService } from './jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of } from 'rxjs';


class MatDialogRefMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public close(value: boolean): void { }
}

class JobsServiceMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public createJob(file1: File, content: string): Observable<object> {
    return of({});
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

  it('should close modal when starting the process', () => {
    const dialogSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.onStartClick();
    expect(dialogSpy).toHaveBeenCalledWith(true);
  });

  it('should start process after clicking start button', () => {
    const mockFile = new File([], 'mockFile', { type: 'text/vcard' });
    component.file = mockFile;
    component.changeView('text editor');
    fixture.detectChanges();

    const ymlArea: HTMLTextAreaElement = templateRef.querySelector('#yml-textarea');

    ymlArea.value = 'some yml text';
    const createJob = jest.spyOn(jobsServiceMock, 'createJob');
    component.onStartClick();
    expect(createJob).toHaveBeenCalledWith(mockFile, 'some yml text');
    expect(ymlArea.value).toBe('');
  });
});
