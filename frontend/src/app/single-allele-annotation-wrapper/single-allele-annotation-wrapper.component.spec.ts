import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SingleAlleleAnnotationWrapperComponent } from './single-allele-annotation-wrapper.component';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';
import { UserData, UsersService } from '../users.service';
import { SingleAnnotationService } from '../single-annotation.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { provideMonacoEditor } from 'ngx-monaco-editor-v2';
import { AnnotationPipelineService } from '../annotation-pipeline.service';
import { SingleAnnotationComponent } from '../single-annotation/single-annotation.component';
import { MatTooltip } from '@angular/material/tooltip';

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

class AnnotationPipelineServiceMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public loadPipeline(name: string): Observable<void> {
    return of();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public savePipeline(id: string, name: string, config: string): Observable<string> {
    return of('id1');
  }
}


// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
(global as any).ResizeObserver = class {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
};


describe('SingleAlleleAnnotationWrapperComponent', () => {
  let component: SingleAlleleAnnotationWrapperComponent;
  let fixture: ComponentFixture<SingleAlleleAnnotationWrapperComponent>;
  const userServiceMock = new UserServiceMock();
  const annotationPipelineServiceMock = new AnnotationPipelineServiceMock();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SingleAlleleAnnotationWrapperComponent],
      providers: [
        JobsService,
        MatTooltip,
        {
          provide: UsersService,
          useValue: userServiceMock
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

    fixture = TestBed.createComponent(SingleAlleleAnnotationWrapperComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
    component.singleAnnotationComponent = TestBed.createComponent(SingleAnnotationComponent).componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should check if user is logged in on component init', () => {
    component.ngOnInit();
    expect(component.isUserLoggedIn).toBe(true);
  });

  it('should auto save and get annonymous pipeline name', () => {
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave')
      .mockReturnValue(of('annonymous pipeline'));
    jest.spyOn(component.pipelinesComponent, 'isPipelineChanged').mockReturnValue(true);

    component.autoSavePipeline();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
    expect(component.pipelineId).toBe('annonymous pipeline');
  });

  it('should auto save pipeline', () => {
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave')
      .mockReturnValue(of('temp'));
    jest.spyOn(component.pipelinesComponent, 'isPipelineChanged').mockReturnValue(true);

    component.autoSavePipeline();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
    expect(component.pipelineId).toBe('temp');
  });

  it('should trigger auto save pipeline when editor is empty', () => {
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave');
    component.pipelinesComponent.currentPipelineText = '';

    component.autoSavePipeline();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
  });

  it('should trigger allele annotation and auto save pipeline', () => {
    fixture.detectChanges();

    component.pipelineId = 'pipeline';
    const pipelinesComponentSpy = jest.spyOn(component.pipelinesComponent, 'autoSave').mockReturnValue(of(''));
    const annotateAlleleSpy = jest.spyOn(component.singleAnnotationComponent, 'annotateAllele');
    jest.spyOn(component.pipelinesComponent, 'isPipelineChanged').mockReturnValue(true);

    component.autoSavePipeline();
    expect(pipelinesComponentSpy).toHaveBeenCalledWith();
    expect(annotateAlleleSpy).toHaveBeenCalledWith();
  });

  it('should trigger allele annotation when catching emits from alleles table', () => {
    fixture.detectChanges();

    const autoSavePipelineSpy = jest.spyOn(component, 'autoSavePipeline');
    const setAlleleSpy = jest.spyOn(component.singleAnnotationComponent, 'setAllele').mockImplementation();

    component.triggerSingleAlleleAnnotation('chr1 123123 TT GG');
    expect(autoSavePipelineSpy).toHaveBeenCalledWith();
    expect(setAlleleSpy).toHaveBeenCalledWith('chr1 123123 TT GG');
  });

  it('should set and load pipeline when catching emits from pipeline component', () => {
    component.pipelineId = 'prev_pipeline';
    const loadPipelineSpy = jest.spyOn(annotationPipelineServiceMock, 'loadPipeline');
    const resetSingleAlleleReportSpy = jest.spyOn(component, 'resetSingleAlleleReport');

    component.setPipeline('pipeline_autism');
    expect(resetSingleAlleleReportSpy).toHaveBeenCalledWith();
    expect(component.pipelineId).toBe('pipeline_autism');
    expect(loadPipelineSpy).toHaveBeenCalledWith('pipeline_autism');
  });

  it('should trigger annotation report reset on pipeline change', () => {
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

  it('should set pipeline config state', () => {
    component.isConfigValid = true;
    const resetSingleAlleleReportSpy = jest.spyOn(component, 'resetSingleAlleleReport');

    component.setConfigValid(true);
    expect(resetSingleAlleleReportSpy).not.toHaveBeenCalledWith();

    component.setConfigValid(false);
    expect(component.isConfigValid).toBe(false);
    expect(resetSingleAlleleReportSpy).toHaveBeenCalledWith();
  });

  it('should trigger alleles table refresh', () => {
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

  it('should display confirmation dialog on beforeUnload event when pipeline is not saved', () => {
    const mockBoeforeUnloadEvent = { preventDefault: jest.fn() } as unknown as BeforeUnloadEvent;
    jest.spyOn(component.pipelinesComponent, 'isPipelineChanged').mockReturnValue(true);
    component.beforeUnload(mockBoeforeUnloadEvent);
    expect(mockBoeforeUnloadEvent.preventDefault).toHaveBeenCalledWith();
  });

  it('should not display confirmation dialog on beforeUnload event when no unsaved changes', () => {
    const mockBoeforeUnloadEvent = { preventDefault: jest.fn() } as unknown as BeforeUnloadEvent;
    jest.spyOn(component.pipelinesComponent, 'isPipelineChanged').mockReturnValue(false);
    component.beforeUnload(mockBoeforeUnloadEvent);
    expect(mockBoeforeUnloadEvent.preventDefault).not.toHaveBeenCalledWith();
  });
});
