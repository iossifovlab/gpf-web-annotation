import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnnotationPipelineComponent } from './annotation-pipeline.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
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
import { SocketNotificationsService } from '../socket-notifications/socket-notifications.service';
import { PipelineNotification } from '../socket-notifications/socket-notifications';

const mockPipelines = [
  new Pipeline('1', 'id1', 'content1', 'default', 'loaded'),
  new Pipeline('2', 'id2', 'content2', 'default', 'loaded'),
  new Pipeline('3', 'id3', 'content3', 'user', 'loaded'),
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
  public createFilePreview(file: File): Observable<FileContent> {
    return of(new FileContent(',', ['chr', 'pos'], [['1', '123']]));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public validatePipelineConfig(config: string): Observable<string> {
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

class SocketNotificationsServiceMock {
  public getPipelineNotifications(): Observable<PipelineNotification> {
    return of(new PipelineNotification('1', 'unloaded'));
  }

  public closeConnection(): void { }
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
  const socketNotificationsServiceMock = new SocketNotificationsServiceMock();

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
        {
          provide: SocketNotificationsService,
          useValue: socketNotificationsServiceMock
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

  it('should set up web socket communication on component init', () => {
    const getSocketNotificationSpy = jest.spyOn(socketNotificationsServiceMock, 'getPipelineNotifications');
    component.ngOnInit();
    expect(getSocketNotificationSpy).toHaveBeenCalledWith();
    expect(component.pipelines[0].status).toBe('unloaded');
  });

  it('should set temporary pipeline id on notification arrival if id is not set', () => {
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');
    jest.spyOn(socketNotificationsServiceMock, 'getPipelineNotifications').mockReturnValueOnce(
      of(new PipelineNotification('215', 'loading'))
    );
    component.currentTemporaryPipelineId = '';
    component.currentTemporaryPipelineStatus = null;
    component.ngOnInit();
    expect(component.currentTemporaryPipelineId).toBe('215');
    expect(component.currentTemporaryPipelineStatus).toBe('loading');
    expect(emitPipelineIdSpy).toHaveBeenCalledWith('215');
  });

  it('should reconnects to socket notifications on close event', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setupSpy = jest.spyOn(component as any, 'setupPipelineWebSocketConnection');
    jest.spyOn(socketNotificationsServiceMock, 'getPipelineNotifications')
      .mockReturnValueOnce(throwError(new CloseEvent('close')));
    const unsubSpy = jest.spyOn(component.socketNotificationSubscription, 'unsubscribe');

    component.ngOnInit();

    expect(unsubSpy).toHaveBeenCalledWith();
    expect(setupSpy).toHaveBeenCalledTimes(2);
  });

  it('does not reconnect for non-close events', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setupSpy = jest.spyOn(component as any, 'setupPipelineWebSocketConnection');
    jest.spyOn(socketNotificationsServiceMock, 'getPipelineNotifications')
      .mockReturnValueOnce(throwError({ type: 'other' }));

    component.ngOnInit();
    expect(setupSpy).toHaveBeenCalledTimes(1);

    const unsubSpy = jest.spyOn(component.socketNotificationSubscription, 'unsubscribe');

    expect(unsubSpy).not.toHaveBeenCalled();
    expect(setupSpy).toHaveBeenCalledTimes(1);
  });

  it('should close socket connection on destroy', () => {
    const closeConnectionSpy = jest.spyOn(socketNotificationsServiceMock, 'closeConnection');
    component.ngOnDestroy();
    expect(closeConnectionSpy).toHaveBeenCalledWith();
  });

  it('should check if user is logged in on component init', () => {
    component.ngOnInit();
    expect(component.isUserLoggedIn).toBe(true);
  });

  it('should check editor\'s options on component init', () => {
    expect(component.yamlEditorOptions).toStrictEqual({
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
      automaticLayout: true
    });
  });

  it('should filter pipelines list in dropdown when typing in input', () => {
    expect(component.filteredPipelines).toStrictEqual(mockPipelines);
    component.dropdownControl.setValue('ID2');
    expect(component.filteredPipelines).toStrictEqual([mockPipelines[1]]);
  });

  it('should not filter pipelines list in dropdown when typing spaces in input', () => {
    expect(component.filteredPipelines).toStrictEqual(mockPipelines);
    component.dropdownControl.setValue('  ');
    expect(component.filteredPipelines).toStrictEqual(mockPipelines);
  });

  it('should determine editor\'s width', () => {
    component.editorSize = 'custom';
    expect(component.editorWidth()).toBe('auto');

    component.editorSize = 'full';
    expect(component.editorWidth()).toBe('95vw');

    component.editorSize = 'small';
    expect(component.editorWidth()).toBe('40vw');
  });

  it('should determine editor\'s height', () => {
    component.editorSize = 'custom';
    expect(component.editorHeight()).toBe('auto');

    component.editorSize = 'full';
    expect(component.editorHeight()).toBe('70vh');

    component.editorSize = 'small';
    expect(component.editorHeight()).toBe('40vh');
  });

  it('should expand editor and hide elements', () => {
    const triggerHideElementsSpy = jest.spyOn(component.tiggerHidingComponents, 'emit');
    component.expandTextarea();
    expect(component.displayFullScreenButton).toBe(false);
    expect(component.displayResetScreenButton).toBe(true);
    expect(component.editorSize).toBe('full');
    expect(triggerHideElementsSpy).toHaveBeenCalledWith(true);
  });

  it('should auto shrink editor and display elements', () => {
    const triggerHideElementsSpy = jest.spyOn(component.tiggerHidingComponents, 'emit');
    component.shrinkTextarea();
    expect(component.displayFullScreenButton).toBe(true);
    expect(component.displayResetScreenButton).toBe(false);
    expect(component.editorSize).toBe('small');
    expect(triggerHideElementsSpy).toHaveBeenCalledWith(false);
  });


  it('should select new pipeline and emit to parent', () => {
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');
    const setDropdownValueSpy = jest.spyOn(component.dropdownControl, 'setValue');
    component.onPipelineClick(new Pipeline('1', 'other pipeline', 'config', 'default', 'loaded'));
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

  it('should select pipeline by providing its name', () => {
    component.selectedPipeline = null;
    component.selectPipelineByName('id3');
    expect(component.selectedPipeline).toStrictEqual(new Pipeline('3', 'id3', 'content3', 'user', 'loaded'));
  });

  it('should reset component state', () => {
    component.selectedPipeline = mockPipelines[2];
    component.resetState();
    expect(component.selectedPipeline.id).toBe('1');
    expect(component.selectedPipeline.content).toBe('content1');
  });

  it('should success config validation', () => {
    const emitIsConfigValid = jest.spyOn(component.emitIsConfigValid, 'emit');

    const configValidationSpy = jest.spyOn(jobsServiceMock, 'validatePipelineConfig');
    component.currentPipelineText = 'config content';
    component.isConfigValid();
    expect(configValidationSpy).toHaveBeenCalledWith('config content');
    expect(component.configError).toBe('');
    expect(emitIsConfigValid).toHaveBeenCalledWith(true);
  });

  it('should fail config validation', () => {
    const emitIsConfigValid = jest.spyOn(component.emitIsConfigValid, 'emit');

    const configValidationSpy = jest.spyOn(jobsServiceMock, 'validatePipelineConfig')
      .mockReturnValue(of('error message'));
    component.currentPipelineText = 'config content';
    component.isConfigValid();
    expect(configValidationSpy).toHaveBeenCalledWith('config content');
    expect(component.configError).toBe('error message');
    expect(emitIsConfigValid).toHaveBeenCalledWith(false);
  });

  it('should display \' *\' when pipeline config is changed and not saved', () => {
    jest.spyOn(component, 'isPipelineChanged').mockReturnValue(true);
    component.dropdownControl.setValue('pipeline-name');
    component.selectedPipeline = new Pipeline('1', 'pipeline-name', 'content', 'user', 'loaded');
    component.isConfigValid();
    expect(component.dropdownControl.value).toBe('pipeline-name *');
  });

  it('should not display \' *\' if it is already displayed', () => {
    jest.spyOn(component, 'isPipelineChanged').mockReturnValue(true);
    component.dropdownControl.setValue('pipeline-name *');
    component.selectedPipeline = new Pipeline('1', 'pipeline-name', 'content', 'user', 'loaded');
    component.isConfigValid();
    expect(component.dropdownControl.value).toBe('pipeline-name *');
  });

  it('should remove \' *\' when pipeline config has not changed and update pipeline id in parent', () => {
    const emitPipelineIdSpy = jest.spyOn(component.emitPipelineId, 'emit');
    jest.spyOn(component, 'isPipelineChanged').mockReturnValue(false);
    component.dropdownControl.setValue('pipeline-name *');
    component.selectedPipeline = new Pipeline('1', 'pipeline-name', 'content', 'user', 'loaded');

    component.isConfigValid();
    expect(component.dropdownControl.value).toBe('pipeline-name');
    expect(emitPipelineIdSpy).toHaveBeenCalledWith('1');
  });

  it('should not add \' *\' when pipeline config is has not been changed', () => {
    jest.spyOn(component, 'isPipelineChanged').mockReturnValue(false);
    component.dropdownControl.setValue('pipeline-name');
    component.selectedPipeline = new Pipeline('1', 'pipeline-name', 'content', 'user', 'loaded');
    component.isConfigValid();
    expect(component.dropdownControl.value).toBe('pipeline-name');
  });

  it('should clear selected pipeline', () => {
    const setDropdownValueSpy = jest.spyOn(component.dropdownControl, 'setValue');
    component.clearPipeline();
    expect(component.selectedPipeline).toBeNull();
    expect(component.currentPipelineText).toBe('');
    expect(setDropdownValueSpy).toHaveBeenCalledWith('');
  });

  it('should not set pipeline name in dropdown input if it contains text', () => {
    const setDropdownValueSpy = jest.spyOn(component.dropdownControl, 'setValue');
    component.displayPipelineNameInInput();
    expect(setDropdownValueSpy).not.toHaveBeenCalledWith();
  });

  it('should set current pipeline name in dropdown input if it is empty', () => {
    const setDropdownValueSpy = jest.spyOn(component.dropdownControl, 'setValue');
    component.selectedPipeline = new Pipeline('1', 'pipeline-name', 'content', 'user', 'loaded');
    component.dropdownControl.setValue('');
    component.displayPipelineNameInInput();
    expect(setDropdownValueSpy).toHaveBeenCalledWith('pipeline-name');
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
      new Pipeline('1', 'id1', 'content1', 'default', 'loaded'),
      new Pipeline('2', 'id2', 'content2', 'default', 'loaded'),
      new Pipeline('3', 'id3', 'content3', 'default', 'loaded'),
      new Pipeline('4', 'pipeline-name', 'content', 'default', 'loaded'),
    ];

    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of('4'));
    const getAnnotationPipelinesSpy = jest.spyOn(jobsServiceMock, 'getAnnotationPipelines')
      .mockReturnValueOnce(of(updatedMockPipelines));
    const onPipelineClickSpy = jest.spyOn(component, 'onPipelineClick');

    component.currentPipelineText = 'mock config';

    component.saveAs();
    expect(savePipelineSpy).toHaveBeenCalledWith('', 'pipeline-name', 'mock config');
    expect(getAnnotationPipelinesSpy).toHaveBeenCalledWith();
    expect(onPipelineClickSpy).toHaveBeenCalledWith(new Pipeline('4', 'pipeline-name', 'content', 'default', 'loaded'));
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

    component.selectedPipeline = new Pipeline('1', 'name', 'content', 'user', 'loaded');

    component.delete();
    expect(deletePipelineSpy).toHaveBeenCalledWith('1');
    expect(selectNewPipelineSpy).toHaveBeenCalledWith(mockPipelines[0]);
  });

  it('should save pipeline and update list with pipelines', () => {
    const updatedMockPipelines: Pipeline[] = [
      new Pipeline('1', 'id1', 'content1', 'default', 'loaded'),
      new Pipeline('2', 'id2', 'content2', 'default', 'loaded'),
      new Pipeline('3', 'id3', 'new content', 'user', 'loaded'),
    ];

    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline');
    jest.spyOn(jobsServiceMock, 'getAnnotationPipelines')
      .mockReturnValueOnce(of(updatedMockPipelines));
    const selectNewPipelineSpy = jest.spyOn(component, 'onPipelineClick');

    component.selectedPipeline = mockPipelines[2];
    component.currentPipelineText = 'new content';

    component.save();
    expect(savePipelineSpy).toHaveBeenCalledWith('3', 'id3', 'new content');
    expect(selectNewPipelineSpy).toHaveBeenCalledWith(new Pipeline('3', 'id3', 'new content', 'user', 'loaded'));
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

    component.selectedPipeline = mockPipelines[2];
    component.currentPipelineText = 'new content';

    component.autoSave();
    expect(savePipelineSpy).toHaveBeenCalledWith('3', 'id3', 'new content');
  });

  it('should save annonymous pipeline', () => {
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of(null));
    const saveSpy = jest.spyOn(component, 'save');

    component.currentTemporaryPipelineId = '';
    component.selectedPipeline = null;
    component.currentPipelineText = 'new content';

    component.autoSave();
    expect(savePipelineSpy).toHaveBeenCalledWith('', '', 'new content');
    expect(saveSpy).not.toHaveBeenCalledWith();
  });

  it('should save edited public pipeline as annonymous', () => {
    const savePipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'savePipeline').mockReturnValueOnce(of(null));
    const saveSpy = jest.spyOn(component, 'save');

    component.currentTemporaryPipelineId = '';
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
