import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnnotationPipelineComponent } from './annotation-pipeline.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { JobCreationComponent } from '../job-creation/job-creation.component';
import { FileContent } from '../job-creation/jobs';
import { JobsService } from '../job-creation/jobs.service';
import { Pipeline } from '../job-creation/pipelines';
import { UserData, UsersService } from '../users.service';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { AnnotationPipelineService } from '../annotation-pipeline.service';
import { ElementRef, TemplateRef } from '@angular/core';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { By } from '@angular/platform-browser';

const mockPipelines = [
  new Pipeline('1', 'id1', 'content1', 'default'),
  new Pipeline('2', 'id2', 'content2', 'default'),
  new Pipeline('3', 'id3', 'content3', 'user'),
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

class MatDialogRefMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public close(name: string): void { }

  public afterClosed(): Observable<string> {
    return of('pipeline-name');
  }
}

class MatDialogMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getDialogById(id: string): MatDialogRefMock {
    return new MatDialogRefMock();
  }

  public afterClosed(): Observable<string> {
    return of('pipeline-name');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @stylistic/max-len
  public open(templateRef: TemplateRef<ElementRef>, config: MatDialogConfig<string>): MatDialogRefMock {
    return new MatDialogRefMock();
  }
}

class AnnotationPipelineServiceMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public savePipeline(id: string, name: string, content: string): Observable<string> {
    return of(id);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public deletePipeline(id: string): Observable<object> {
    return of({});
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
(global as any).ResizeObserver = class {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
};


describe('AnnotationPipelineComponent', () => {
  let component: AnnotationPipelineComponent;
  let fixture: ComponentFixture<AnnotationPipelineComponent>;
  const jobsServiceMock = new JobsServiceMock();
  const userServiceMock = new UserServiceMock();
  const mockMatDialogRef = new MatDialogRefMock();
  const mockMatRef = new MatDialogMock();
  const annotationPipelineServiceMock = new AnnotationPipelineServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [JobCreationComponent],
      providers: [
        {
          provide: JobsService,
          useValue: jobsServiceMock
        },
        {
          provide: UsersService,
          useValue: userServiceMock
        },
        {
          provide: MatDialogRef,
          useValue: mockMatDialogRef
        },
        {
          provide: MatDialog,
          useValue: mockMatRef
        },
        {
          provide: AnnotationPipelineService,
          useValue: annotationPipelineServiceMock
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMonacoEditor(),
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AnnotationPipelineComponent);
    component = fixture.componentInstance;

    jest.spyOn(mockMatRef, 'getDialogById').mockReturnValue(mockMatDialogRef);
    jest.spyOn(mockMatRef, 'open').mockReturnValue(mockMatDialogRef);

    // Mock monaco
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (window as any).monaco = {
      editor: {
        defineTheme: jest.fn(),
        setTheme: jest.fn(),
        create: jest.fn(),
        onInit: jest.fn(),
        dispose: jest.fn(),
      }
    };

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

  it('should select new pipeline and emit to parent', () => {
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');
    const setDropdownValueSpy = jest.spyOn(component.dropdownControl, 'setValue');
    component.onPipelineClick(new Pipeline('1', 'other pipeline', 'config', 'default'));
    expect(component.selectedPipeline.id).toBe('1');
    expect(component.selectedPipeline.name).toBe('other pipeline');
    expect(component.selectedPipeline.content).toBe('config');
    expect(emitPipelineIdSpy).toHaveBeenCalledWith('1');
    expect(setDropdownValueSpy).toHaveBeenCalledWith('other pipeline');
  });

  it('should not set new pipeline if invalid one', () => {
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');
    const setDropdownValueSpy = jest.spyOn(component.dropdownControl, 'setValue');

    component.onPipelineClick(null);
    expect(component.selectedPipeline.id).toBe('1');
    expect(component.selectedPipeline.content).toBe('content1');
    expect(emitPipelineIdSpy).not.toHaveBeenCalledWith();
    expect(setDropdownValueSpy).not.toHaveBeenCalledWith();
  });

  it('should reset component state', () => {
    component.selectedPipeline = mockPipelines[2];
    component.resetState();
    expect(component.selectedPipeline.id).toBe('1');
    expect(component.selectedPipeline.content).toBe('content1');
  });

  it('should success config validation', () => {
    const emitIsConfigValid = jest.spyOn(component.emitIsConfigValid, 'emit');

    const configValidationSpy = jest.spyOn(jobsServiceMock, 'validateJobConfig');
    component.currentPipelineText = 'config content';
    component.isConfigValid();
    expect(configValidationSpy).toHaveBeenCalledWith('config content');
    expect(component.configError).toBe('');
    expect(emitIsConfigValid).toHaveBeenCalledWith(true);
  });

  it('should fail config validation', () => {
    const emitIsConfigValid = jest.spyOn(component.emitIsConfigValid, 'emit');

    const configValidationSpy = jest.spyOn(jobsServiceMock, 'validateJobConfig').mockReturnValue(of('error message'));
    component.currentPipelineText = 'config content';
    component.isConfigValid();
    expect(configValidationSpy).toHaveBeenCalledWith('config content');
    expect(component.configError).toBe('error message');
    expect(emitIsConfigValid).toHaveBeenCalledWith(false);
  });

  it('should clear selected pipeline', () => {
    const setDropdownValueSpy = jest.spyOn(component.dropdownControl, 'setValue');
    component.clearPipeline();
    expect(component.selectedPipeline).toBeNull();
    expect(component.currentPipelineText).toBe('');
    expect(setDropdownValueSpy).toHaveBeenCalledWith('');
  });

  it('should save pipeline name', () => {
    const closeModalSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.saveName('pipeline-name');
    expect(closeModalSpy).toHaveBeenCalledWith('pipeline-name');
  });

  it('should cancel setting pipeline name', () => {
    const closeModalSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.cancel();
    expect(closeModalSpy).toHaveBeenCalledWith();
  });

  it('should save pipeline and trigger pipelines query if new name is set', () => {
    const updatedMockPipelines = [
      new Pipeline('1', 'id1', 'content1', 'default'),
      new Pipeline('2', 'id2', 'content2', 'default'),
      new Pipeline('3', 'id3', 'content3', 'default'),
      new Pipeline('4', 'pipeline-name', 'content', 'default'),
    ];

    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of('4'));
    const getAnnotationPipelinesSpy = jest.spyOn(jobsServiceMock, 'getAnnotationPipelines')
      .mockReturnValueOnce(of(updatedMockPipelines));
    const onPipelineClickSpy = jest.spyOn(component, 'onPipelineClick');

    component.currentPipelineText = 'mock config';

    component.saveAs();
    expect(savePipelineSpy).toHaveBeenCalledWith('', 'pipeline-name', 'mock config');
    expect(getAnnotationPipelinesSpy).toHaveBeenCalledWith();
    expect(onPipelineClickSpy).toHaveBeenCalledWith(new Pipeline('4', 'pipeline-name', 'content', 'default'));
    expect(component.selectedPipeline.id).toBe('4');
  });

  it('should not save pipeline and trigger pipelines query if new pipeline has no name', () => {
    jest.spyOn(mockMatDialogRef, 'afterClosed').mockReturnValueOnce(of(null));
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline');
    const getAnnotationPipelinesSpy = jest.spyOn(jobsServiceMock, 'getAnnotationPipelines');
    const onPipelineClickSpy = jest.spyOn(component, 'onPipelineClick');

    component.currentPipelineText = 'mock config';

    component.saveAs();
    expect(savePipelineSpy).not.toHaveBeenCalledWith();
    expect(getAnnotationPipelinesSpy).not.toHaveBeenCalledTimes(2);
    expect(onPipelineClickSpy).not.toHaveBeenCalledWith();
    expect(component.selectedPipeline.id).toBe('1');
  });

  it('should delete pipeline', () => {
    const deletePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'deletePipeline');
    const selectNewPipelineSpy = jest.spyOn(component, 'onPipelineClick');

    component.selectedPipeline = new Pipeline('1', 'name', 'content', 'type');

    component.delete();
    expect(deletePipelineSpy).toHaveBeenCalledWith('1');
    expect(selectNewPipelineSpy).toHaveBeenCalledWith(mockPipelines[0]);
  });

  it('should save pipeline and update list with pipelines', () => {
    const updatedMockPipelines: Pipeline[] = [
      new Pipeline('1', 'id1', 'content1', 'default'),
      new Pipeline('2', 'id2', 'content2', 'default'),
      new Pipeline('3', 'id3', 'new content', 'user'),
    ];

    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline');
    jest.spyOn(jobsServiceMock, 'getAnnotationPipelines')
      .mockReturnValueOnce(of(updatedMockPipelines));
    const selectNewPipelineSpy = jest.spyOn(component, 'onPipelineClick');

    component.selectedPipeline = mockPipelines[2];
    component.currentPipelineText = 'new content';

    component.save();
    expect(savePipelineSpy).toHaveBeenCalledWith('3', 'id3', 'new content');
    expect(selectNewPipelineSpy).toHaveBeenCalledWith(new Pipeline('3', 'id3', 'new content', 'user'));
  });

  it('should save pipeline and not update pipeline list when response is invalid', () => {
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of(null));
    const getAnnotationPipelinesSpy = jest.spyOn(jobsServiceMock, 'getAnnotationPipelines');

    component.selectedPipeline = mockPipelines[0];
    component.currentPipelineText = 'new content';

    component.save();
    expect(savePipelineSpy).toHaveBeenCalledWith('3', 'id3', 'new content');
    expect(getAnnotationPipelinesSpy).not.toHaveBeenCalledTimes(2);
  });

  it('should not save pipeline when there are no changes', () => {
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of(null));

    component.selectedPipeline = mockPipelines[0];
    component.currentPipelineText = 'content1';

    component.save();
    expect(savePipelineSpy).not.toHaveBeenCalledWith();
  });

  it('should auto save current pipeline', () => {
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of(null));
    const saveSpy = jest.spyOn(component, 'save');

    component.selectedPipeline = mockPipelines[2];
    component.currentPipelineText = 'new content';

    component.autoSave();
    expect(savePipelineSpy).toHaveBeenCalledWith('3', 'id3', 'new content');
    expect(saveSpy).toHaveBeenCalledWith();
  });

  it('should save annonymous pipeline', () => {
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of(null));
    const saveSpy = jest.spyOn(component, 'save');

    component.selectedPipeline = null;
    component.currentPipelineText = 'new content';

    component.autoSave();
    expect(savePipelineSpy).toHaveBeenCalledWith('', '', 'new content');
    expect(saveSpy).not.toHaveBeenCalledWith();
  });

  it('should save edited public pipeline as annonymous', () => {
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of(null));
    const saveSpy = jest.spyOn(component, 'save');

    component.selectedPipeline = mockPipelines[0];
    component.currentPipelineText = 'new content';

    component.autoSave();
    expect(savePipelineSpy).toHaveBeenCalledWith('', '', 'new content');
    expect(saveSpy).not.toHaveBeenCalledWith();
  });

  it('should get pipeline editor config options on init', () => {
    component.pipelines = mockPipelines;
    const editorInitSpy = jest.spyOn(component, 'onEditorInit');

    const monacoEditor = fixture.debugElement.query(By.css('ngx-monaco-editor'));

    // Manually trigger (onInit) of editor
    monacoEditor.triggerEventHandler('onInit', { fake: 'editorInstance' });

    expect(editorInitSpy).toHaveBeenCalledWith();
    expect(component.yamlEditorOptions).toStrictEqual(
      {
        language: 'yaml',
        minimap: {
          enabled: false
        },
        lineNumbers: 'off',
        folding: false,
        stickyScroll: {
          enabled: false,
        },
        scrollBeyondLastLine: false,
        theme: 'annotationPipelineTheme',
        automaticLayout: true,
      }
    );
  });

  it('should create theme on editor init', () => {
    component.pipelines = mockPipelines;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const defineThemeSpy = jest.spyOn((window as any).monaco.editor, 'defineTheme');

    const monacoEditor = fixture.debugElement.query(By.css('ngx-monaco-editor'));

    // Manually trigger (onInit) of editor
    monacoEditor.triggerEventHandler('onInit', { fake: 'editorInstance' });

    fixture.detectChanges();
    expect(defineThemeSpy).toHaveBeenCalledWith('annotationPipelineTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        {
          foreground: '#dd8108ff',
          token: 'type'
        },

        {
          foreground: '#85a2b9',
          token: 'string'
        },
        {
          foreground: '#85a2b9',
          token: 'number'
        },
        {
          foreground: '#2f404eff',
          token: 'keyword'
        },
        {
          foreground: '#75715e',
          token: 'comment'
        },
      ],
      colors: {
        'editor.foreground': '#2f404eff',
        'editor.background': '#FFFFFF',
        'editor.selectionForeground': '#915b15ff',
        'editor.selectionBackground': '#e7e6e4ff',
        'editor.inactiveSelectionBackground': '#ebeae8ff',
        'editor.lineHighlightBackground': '#f0efe9b0',
        'editorCursor.foreground': '#383838ff',
        'editorWhitespace.foreground': '#c9d2ddff',
        'editor.wordHighlightBackground': '#e9e6dfff',
        'scrollbar.shadow': '#c9d2ddff',
        'scrollbarSlider.background': '#dfdfdfa2',
        'scrollbarSlider.hoverBackground': '#b3bbc583',
        'scrollbarSlider.activeBackground': '#b3bbc583',
        'editorIndentGuide.background1': '#dbdbdbe0',
        'editorIndentGuide.activeBackground1': '#a4b6c7ff',
      }
    });
  });
});
