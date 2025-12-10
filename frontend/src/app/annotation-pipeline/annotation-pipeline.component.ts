import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { map, Observable, of, startWith, switchMap, take } from 'rxjs';
import { JobsService } from '../job-creation/jobs.service';
import { Pipeline } from '../job-creation/pipelines';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AnnotationPipelineService } from '../annotation-pipeline.service';
import { MatDialog } from '@angular/material/dialog';
import { EditorComponent, MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { editorConfig, initEditor } from './annotation-pipeline-editor.config';
import { UsersService } from '../users.service';
import { SocketNotificationsService } from '../socket-notifications/socket-notifications.service';
import { PipelineNotification } from '../socket-notifications/socket-notifications';

@Component({
  selector: 'app-annotation-pipeline',
  imports: [
    CommonModule,
    FormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    FormsModule,
    MonacoEditorModule,
  ],
  templateUrl: './annotation-pipeline.component.html',
  styleUrl: './annotation-pipeline.component.css'
})

export class AnnotationPipelineComponent implements OnInit, OnDestroy, AfterViewInit {
  public pipelines : Pipeline[] = [];
  public currentPipelineText = '';
  public selectedPipeline: Pipeline = null;
  public configError = '';
  @Output() public emitPipelineId = new EventEmitter<string>();
  @Output() public emitIsConfigValid = new EventEmitter<boolean>();
  public filteredPipelines: Pipeline[] = null;
  public dropdownControl = new FormControl<string>('');
  @ViewChild('nameInput') public nameInputTemplateRef: TemplateRef<ElementRef>;
  @ViewChild('pipelineEditor') public pipelineEditorRef: EditorComponent;
  public resizeObserver: ResizeObserver = null;
  public yamlEditorOptions = {};
  public isFullScreen = false;
  public setEditorMaxSize = false;
  @Output() public tiggerHidingComponents = new EventEmitter<boolean>();
  public isUserLoggedIn = false;
  public lastNotification: PipelineNotification = null;

  public constructor(
    private jobsService: JobsService,
    private annotationPipelineService: AnnotationPipelineService,
    private dialog: MatDialog,
    private userService: UsersService,
    private socketNotificationsService: SocketNotificationsService,
  ) { }

  public onEditorInit(): void {
    initEditor();
  }

  public ngOnInit(): void {
    this.userService.userData.pipe(
    ).subscribe((userData) => {
      this.isUserLoggedIn = Boolean(userData);
    });

    this.yamlEditorOptions = editorConfig;
    this.getPipelines();
    this.dropdownControl.valueChanges.pipe(
      startWith(''),
      map(value => this.filter(value || '')),
    ).subscribe(filtered => {
      this.filteredPipelines = filtered;
    });

    this.setupPipelineWebSocketConnection();
  }

  public ngAfterViewInit(): void {
    const editorElement = this.pipelineEditorRef._editorContainer.nativeElement as HTMLElement;

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.isEditorMaximized(editorElement)) {
        this.resolveComponentsVisibility(editorElement);
      }
    });

    this.resizeObserver.observe(editorElement);
  }

  private setupPipelineWebSocketConnection(): void {
    this.socketNotificationsService.getPipelineNotifications().subscribe({
      next: (notification: PipelineNotification) => {
        this.lastNotification = notification;
      },
      error: err => {
        console.error(err);
      },
      complete: () => {
        this.lastNotification = null;
      }
    });
  }

  private isEditorMaximized(editorElement: HTMLElement): boolean {
    // editor's max-width is 95% of window width
    if (editorElement.clientWidth === Math.ceil(window.innerWidth * 0.95)) {
      this.expandTextarea();
      return true;
    } else {
      this.isFullScreen = false;
      return false;
    }
  }

  private resolveComponentsVisibility(editorElement: HTMLElement): void {
    const parentWidth = document.getElementById('annotation-container').clientWidth;
    if (!this.isEditorMaximized(editorElement)) {
      if (editorElement.clientWidth > parentWidth/1.5) {
        this.hideParentComponents();
      } else if (editorElement.clientWidth < parentWidth/1.5) {
        this.showParentComponents();
      }
    }
  }

  private getPipelines(defaultPipelineId: string = ''): void {
    this.jobsService.getAnnotationPipelines().pipe(take(1)).subscribe(pipelines => {
      this.pipelines = pipelines;
      this.filteredPipelines = this.pipelines;
      if (defaultPipelineId) {
        this.onPipelineClick(this.pipelines.find(p => p.id === defaultPipelineId));
      } else {
        this.onPipelineClick(this.pipelines[0]);
      }
    });
  }

  private filter(value: string): Pipeline[] {
    const filterValue = this.normalizeValue(value);
    return this.pipelines.filter(p => this.normalizeValue(p.name).includes(filterValue));
  }

  private normalizeValue(value: string): string {
    return value.toLowerCase().replace(/\s/g, '');
  }

  public resetState(): void {
    this.onPipelineClick(this.pipelines[0]);
  }

  public isConfigValid(): void {
    this.jobsService.validateJobConfig(this.currentPipelineText).pipe(
      take(1)
    ).subscribe((errorReason: string) => {
      this.configError = errorReason;
      if (!this.configError) {
        this.emitIsConfigValid.emit(true);
      } else {
        this.emitIsConfigValid.emit(false);
      }
    });
  }

  public onPipelineClick(pipeline: Pipeline): void {
    if (!pipeline) {
      return;
    }
    this.configError = '';
    this.emitIsConfigValid.emit(true);
    this.selectedPipeline = pipeline;
    this.currentPipelineText = pipeline.content;
    this.emitPipelineId.emit(this.selectedPipeline.id);
    this.dropdownControl.setValue(this.selectedPipeline.name);
  }

  public clearPipeline(): void {
    this.lastNotification = null;
    this.selectedPipeline = null;
    this.emitPipelineId.emit(null);
    this.currentPipelineText = '';
    this.configError = '';
    this.dropdownControl.setValue('');
  }

  public saveAs(): void {
    const newNameModalRef = this.dialog.open(this.nameInputTemplateRef, {
      id: 'setPipelineName',
      width: '30vw',
      maxWidth: '700px'
    });

    newNameModalRef.afterClosed().pipe(
      switchMap((name: string) => {
        if (name) {
          return this.annotationPipelineService.savePipeline('', name, this.currentPipelineText);
        }
        return of(null);
      }),
    ).subscribe((pipelineId: string) => {
      if (!pipelineId) {
        return;
      }
      this.getPipelines(pipelineId);
    });
  }

  public autoSave(): Observable<string> {
    if (!this.selectedPipeline || (this.isPipelineChanged() && this.selectedPipeline.type === 'default')) {
      return this.annotationPipelineService.savePipeline('', '', this.currentPipelineText);
    } else {
      this.save();
      return of(null);
    }
  }

  public save(): void {
    if (!this.isPipelineChanged()) {
      return;
    }

    this.annotationPipelineService.savePipeline(
      this.selectedPipeline.id,
      this.selectedPipeline.name,
      this.currentPipelineText,
    ).subscribe((pipelineId: string) => {
      if (!pipelineId) {
        return;
      }
      this.getPipelines(pipelineId);
    });
  }

  public delete(): void {
    this.annotationPipelineService.deletePipeline(this.selectedPipeline.id).subscribe(() => this.getPipelines());
  }

  public saveName(name: string): void {
    this.dialog.getDialogById('setPipelineName').close(name);
  }

  public cancel(): void {
    this.dialog.getDialogById('setPipelineName').close();
  }

  public isPipelineChanged(): boolean {
    return this.selectedPipeline?.content.trim() !== this.currentPipelineText.trim();
  }

  public expandTextarea(): void {
    this.isFullScreen = true;
    this.setEditorMaxSize = true;
    this.hideParentComponents();
  }

  public shrinkTextarea(): void {
    this.isFullScreen = false;
    this.setEditorMaxSize = false;
    this.showParentComponents();
  }

  private showParentComponents(): void {
    this.tiggerHidingComponents.emit(false);
  }

  private hideParentComponents(): void {
    this.tiggerHidingComponents.emit(true);
  }

  public ngOnDestroy(): void {
    this.socketNotificationsService.closeConnection();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
