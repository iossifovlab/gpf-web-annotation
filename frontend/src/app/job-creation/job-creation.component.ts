import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatDialogRef, MatDialogActions, MatDialogContent } from '@angular/material/dialog';


@Component({
  selector: 'app-job-creation',
  imports: [MatDialogActions, MatDialogContent, CommonModule],
  templateUrl: './job-creation.component.html',
  styleUrl: './job-creation.component.css'
})
export class JobCreationComponent {
  public file: File = null;
  public uploadError = '';

  private MAX_FILE_SIZE_BYTES = 5000000;

  public constructor(private dialogRef: MatDialogRef<JobCreationComponent>) { }

  public onStartClick(): void {
    this.dialogRef.close(true);
  }

  public onCancelClick(): void {
    this.dialogRef.close(true);
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

      this.isFormatValid(file);


      this.onFileChange(file);
    }
  }

  private isFormatValid(file: File): void {
    if (!file.type.includes('csv') && !file.type.includes('vcf')) {
      this.uploadError = 'Unsupported format!';
      return;
    }
    this.isInSizeRange(file);
  }

  private isInSizeRange(file: File): void {
    console.log((file.size / (1024 * 1024)).toFixed(2));
    if (file.size > this.MAX_FILE_SIZE_BYTES) {
      this.uploadError = 'Size limit is 5 MB!';
    }
  }

  public removeFile(): void {
    this.file = null;
  }

  private onFileChange(file: File): void {
    this.file = file;
  }
}
