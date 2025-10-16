import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FileContent } from '../job-creation/jobs';

@Component({
  selector: 'app-column-specifying-modal',
  imports: [CommonModule],
  templateUrl: './column-specifying-modal.component.html',
  styleUrl: './column-specifying-modal.component.css'
})
export class ColumnSpecifyingModalComponent implements OnInit {
  public fileContent: FileContent;
  public columnNames = ['chrom', 'pos', 'ref', 'alt'];
  public mappedColumns = new Map<string, string>();

  public constructor(
     @Inject(MAT_DIALOG_DATA) public content: FileContent,
    private dialogRef: MatDialogRef<ColumnSpecifyingModalComponent>
  ) { }

  public ngOnInit(): void {
    this.fileContent = this.content;
  }

  public onSelectName(event: Event, column: string): void {
    const selectedName = (event.target as HTMLSelectElement).value;
    this.mappedColumns.set(selectedName, column);
  }
}
