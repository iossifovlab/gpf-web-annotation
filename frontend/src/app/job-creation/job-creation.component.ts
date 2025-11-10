import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FileContent, JobCreationView } from './jobs';
import { JobsService } from './jobs.service';
import { Observable, take } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ColumnSpecifyingComponent } from '../column-specifying/column-specifying.component';
import { UsersService } from '../users.service';
import { AnnotationPipelineComponent } from '../annotation-pipeline/annotation-pipeline.component';

@Component({
  selector: 'app-job-creation',
  imports: [
    CommonModule,
    FormsModule,
    ColumnSpecifyingComponent,
    AnnotationPipelineComponent
  ],
  templateUrl: './job-creation.component.html',
  styleUrl: './job-creation.component.css'
})
export class JobCreationComponent implements OnInit {
  public file: File = null;
  public fileSeparator: string = null;
  public fileContent: FileContent;
  public updatedFileHeader = new Map<string, string>();
  public uploadError = '';
  public selectedGenome = '';
  public pipelineId = '';
  public ymlConfig = '';
  public isConfigValid = true;
  public creationError = '';
  public view: JobCreationView = 'pipeline list';
  public userLimitations: {
      dailyJobs: number;
      filesize: string;
      jobsLeft: number;
      variantCount: number;
  } = null;

  public constructor(
    private jobsService: JobsService,
    private usersService: UsersService,
  ) { }

  public ngOnInit(): void {
    this.userLimitations = this.usersService.userData.value.limitations;
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
            this.fileSeparator,
            this.updatedFileHeader
          );
        } else {
          createObservable = this.jobsService.createNonVcfJob(
            this.file,
            this.pipelineId,
            null,
            this.selectedGenome,
            this.fileSeparator,
            this.updatedFileHeader
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
        },
        error: (err: Error) => {
          this.creationError = err.message;
        }
      });
    }
  }

  public getColumns(mappedColumns: Map<string, string>): void {
    this.updatedFileHeader = mappedColumns;
  }

  public submitNewSeparator(newSeparator: string): void {
    this.fileSeparator = newSeparator;
    this.jobsService.submitSeparator(this.file, newSeparator).pipe(take(1)).subscribe(res => {
      this.fileContent = res;
      this.fileSeparator = res.separator;
    });
  }

  public onCancelClick(): void {
    this.creationError = '';
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

  private isFormatValid(file: File): boolean {
    const validFileExtensions = ['csv', 'vcf', 'tsv', 'txt', 'gz', 'bgz'];
    const fileExtention = file.name.split('.').reverse()[0];
    if (!validFileExtensions.includes(fileExtention)) {
      this.uploadError = 'Unsupported format!';
      return false;
    }
    return true;
  }

  public removeFile(): void {
    this.creationError = '';
    this.file = null;
    this.uploadError = '';
    this.fileContent = null;
    this.fileSeparator = '';
  }

  private onFileChange(file: File): void {
    this.file = file;
    if (!file.name.endsWith('.vcf') && this.isFormatValid(file)) {
      this.submitFile();
    }
  }

  private submitFile(): void {
    this.jobsService.submitFile(this.file).pipe(take(1)).subscribe(res => {
      this.fileContent = res;
      this.fileSeparator = res.separator;
    });
  }

  public setPipeline(newPipeline: string): void {
    this.pipelineId = newPipeline;
  }

  public setConfig(newConfig: string): void {
    this.ymlConfig = newConfig;
  }

  public setView(newView: JobCreationView): void {
    this.view = newView;
  }

  public setGenome(genome: string): void {
    this.selectedGenome = genome;
  }

  public setConfigValid(newState: boolean): void {
    this.isConfigValid = newState;
    this.disableCreate();
  }

  public disableCreate(): boolean {
    return !this.file
      || Boolean(this.uploadError)
      || !this.isConfigValid
      || (this.view === 'text editor' ? !this.ymlConfig : !this.pipelineId);
  }
}
