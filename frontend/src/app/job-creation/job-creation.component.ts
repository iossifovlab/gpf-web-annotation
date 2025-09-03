import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogActions, MatDialogContent } from '@angular/material/dialog';
import { JobCreationView } from './jobs';
import { JobsService } from './jobs.service';
import { take } from 'rxjs';
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

  public constructor(private dialogRef: MatDialogRef<JobCreationComponent>, private jobsService: JobsService) { }

  public ngOnInit(): void {
    this.jobsService.getAnnotationPipelines().pipe(take(1)).subscribe(pipelines => {
      this.pipelines = pipelines;
    });
  }

  public onCreateClick(): void {
    this.dialogRef.close(true);
    if (this.file) {
      if (this.view === 'text editor') {
        this.jobsService.createJob(this.file, null, this.ymlConfig).subscribe();
        this.ymlConfig = '';
      } else {
        this.jobsService.createJob(this.file, this.pipelineId, null).subscribe();
      }
    }
  }

  public onCancelClick(): void {
    this.dialogRef.close(true);
  }

  public onPipelineClick(option: string): void {
    this.pipelineId = option;
  }

  public onUpload(event: Event): void {
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

  private isFormatValid(file: File): void {
    if (file.type !== 'text/csv' && file.type !== 'text/vcard') {
      this.uploadError = 'Unsupported format!';
    }
  }

  public removeFile(): void {
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
