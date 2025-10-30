import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogActions, MatDialogContent } from '@angular/material/dialog';
import { FileContent, JobCreationView } from './jobs';
import { JobsService } from './jobs.service';
import { Observable, take } from 'rxjs';
import { Pipeline } from './pipelines';
import { FormsModule } from '@angular/forms';
import { SingleAnnotationService } from '../single-annotation.service';
import { ColumnSpecifyingModalComponent } from '../column-specifying-modal/column-specifying-modal.component';


@Component({
  selector: 'app-job-creation',
  imports: [MatDialogActions, MatDialogContent, CommonModule, FormsModule, ColumnSpecifyingModalComponent],
  templateUrl: './job-creation.component.html',
  styleUrl: './job-creation.component.css'
})
export class JobCreationComponent implements OnInit {
  public file: File = null;
  public fileSeparator: string = null;
  public fileContent: FileContent;
  public uploadError = '';
  public view: JobCreationView = 'pipeline list';
  public pipelines : Pipeline[] = [];
  public genomes : string[] = [];
  public selectedGenome = '';
  public pipelineId = '';
  public ymlConfig = '';
  public configError = '';
  public creationError = '';

  public constructor(
    private dialogRef: MatDialogRef<JobCreationComponent>,
    private jobsService: JobsService,
    private singleAnnotationService: SingleAnnotationService,
  ) { }

  public ngOnInit(): void {
    this.jobsService.getAnnotationPipelines().pipe(take(1)).subscribe(pipelines => {
      this.pipelines = pipelines;
    });

    this.singleAnnotationService.getGenomes().pipe(take(1)).subscribe((genomes) => {
      this.genomes = genomes;
      this.selectedGenome = genomes[0];
    });
  }

  public onCreateClick(): void {
    if (this.file) {
      let createObservable: Observable<object>;
      if (this.file.type !== 'text/vcard') {
        if (this.view === 'text editor') {
          createObservable = this.jobsService.createNonVcfJob(
            this.file,
            null,
            this.ymlConfig,
            this.selectedGenome,
            this.fileSeparator
          );
        } else {
          createObservable = this.jobsService.createNonVcfJob(
            this.file,
            this.pipelineId,
            null,
            this.selectedGenome,
            this.fileSeparator
          );
        }
      } else if (this.file.type === 'text/vcard') {
        if (this.view === 'text editor') {
          createObservable = this.jobsService.createVcfJob(
            this.file,
            null,
            this.ymlConfig,
            this.selectedGenome,
          );
        } else {
          createObservable = this.jobsService.createVcfJob(
            this.file,
            this.pipelineId,
            null,
            this.selectedGenome,
          );
        }
      }
      createObservable.pipe(take(1)).subscribe({
        next: () => {
          this.ymlConfig = '';
          this.dialogRef.close({isCanceled: false});
        },
        error: (err: Error) => {
          this.creationError = err.message;
        }
      });
    }
  }

  public onCancelClick(): void {
    this.creationError = '';
    this.dialogRef.close({isCanceled: true, fileContent: null});
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
    const validFormats = ['text/csv', 'text/vcard', 'text/tab-separated-values', 'text/plain'];
    if (!validFormats.includes(file.type)) {
      this.uploadError = 'Unsupported format!';
    }
  }

  public removeFile(): void {
    this.creationError = '';
    this.file = null;
    this.uploadError = '';
    this.fileContent = null;
  }

  private onFileChange(file: File): void {
    this.isFormatValid(file);
    this.file = file;
    if (file.type !== 'vcf') {
      this.submitFile();
    }
  }

  private submitFile(): void {
    this.jobsService.submitFile(this.file).pipe(take(1)).subscribe(res => {
      this.fileContent = res;
    });
  }

  public changeView(view: JobCreationView): void {
    if (view === 'pipeline list') {
      this.ymlConfig = '';
      this.configError = '';
    } else {
      this.pipelineId = '';
    }
    this.view = view;
  }

  public disableCreate(): boolean {
    return !this.file
      || Boolean(this.uploadError)
      || Boolean(this.configError)
      || (this.view === 'text editor' ? !this.ymlConfig : !this.pipelineId)
      || (this.fileSeparator === null && !this.file?.name?.endsWith('vcf'));
  }
}
