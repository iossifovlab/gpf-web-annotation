import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogActions, MatDialogContent } from '@angular/material/dialog';
import { JobCreationView } from './jobs';
import { JobsService } from './jobs.service';
import { Observable, take } from 'rxjs';
import { Pipeline } from './pipelines';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-job-creation',
  imports: [MatDialogActions, MatDialogContent, CommonModule, FormsModule],
  templateUrl: './job-creation.component.html',
  styleUrl: './job-creation.component.css'
})
export class JobCreationComponent implements OnInit {
  public file: File = null;
  public uploadError = '';
  public view: JobCreationView = 'pipeline list';
  public pipelines : Pipeline[] = [];
  public pipelineId = '';
  public ymlConfig = '';
  public configError = '';
  public creationError = '';

  public constructor(private dialogRef: MatDialogRef<JobCreationComponent>, private jobsService: JobsService) { }

  public ngOnInit(): void {
    this.jobsService.getAnnotationPipelines().pipe(take(1)).subscribe(pipelines => {
      this.pipelines = pipelines;
    });
  }

  public onCreateClick(): void {
    if (this.file) {
      let createObservable: Observable<object>;
      if (this.view === 'text editor') {
        createObservable = this.jobsService.createJob(this.file, null, this.ymlConfig);
        this.ymlConfig = '';
      } else {
        createObservable = this.jobsService.createJob(this.file, this.pipelineId, null);
      }
      createObservable.pipe(take(1)).subscribe({
        next: (resp) => this.dialogRef.close(resp),
        error: (err: Error) => {
          this.creationError = err.message;
        }
      });
    }
  }

  public onCancelClick(): void {
    this.creationError = '';
    this.dialogRef.close(false);
  }

  public onPipelineClick(option: string): void {
    this.creationError = '';
    this.pipelineId = option;
  }

  public onUpload(event: Event): void {
    this.creationError = '';
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.onFileChange(input.files[0]);
    }
  }

  public onDragOver(event: Event): void {
    event.preventDefault();
  }

  public onDropSuccess(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.onFileChange(file);
    }
  }

  public isConfigValid(config: string): void {
    this.creationError = '';
    this.jobsService.validateJobConfig(config).pipe(
      take(1)
    ).subscribe((errorReason: string) => {
      this.configError = errorReason;
    });
  }

  private isFormatValid(file: File): void {
    const validFormats = ['text/csv', 'text/vcard', 'text/tab-separated-values'];
    if (!validFormats.includes(file.type)) {
      this.uploadError = 'Unsupported format!';
    }
  }

  public removeFile(): void {
    this.creationError = '';
    this.file = null;
    this.uploadError = '';
  }

  private onFileChange(file: File): void {
    this.isFormatValid(file);
    this.file = file;
  }

  public changeView(view: JobCreationView): void {
    this.pipelineId = '';
    this.view = view;
  }

  public disableCreate(): boolean {
    return !this.file ||
      Boolean(this.uploadError) ||
      (this.view === 'text editor' ? !this.ymlConfig : !this.pipelineId);
  }
}
