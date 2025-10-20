import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FileContent } from '../job-creation/jobs';
import { TextShortenPipe } from '../text-shorten.pipe';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { JobsService } from '../job-creation/jobs.service';

@Component({
  selector: 'app-column-specifying-modal',
  imports: [CommonModule, TextShortenPipe, MatSelectModule, MatFormFieldModule],
  templateUrl: './column-specifying-modal.component.html',
  styleUrl: './column-specifying-modal.component.css'
})
export class ColumnSpecifyingModalComponent implements OnInit {
  public fileContent: FileContent;
  public columnNames = ['chrom', 'pos', 'ref', 'alt'];
  public mappedColumns = new Map<string, string>();

  public constructor(
     @Inject(MAT_DIALOG_DATA) public content: FileContent,
    private dialogRef: MatDialogRef<ColumnSpecifyingModalComponent>,
    private jobsService: JobsService
  ) { }

  public ngOnInit(): void {
    this.fileContent = this.content;
  }

  public onSelectName(selectedName: string, column: string): void {
    const key = this.getFileColumnKey(column);
    if (selectedName === 'None' && key) {
      this.mappedColumns.delete(key);
      return;
    }
    if (key) {
      this.mappedColumns.delete(key);
    }
    this.mappedColumns.set(selectedName, column);
  }

  private getFileColumnKey(column: string): string {
    for (const [key, value] of this.mappedColumns.entries()) {
      if (value === column) {
        return key;
      }
    }
    return null;
  }

  public submitColumns(): void {
    this.jobsService.specifyColumns(this.fileContent.jobId, this.mappedColumns).subscribe();
  }
}
