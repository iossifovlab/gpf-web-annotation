import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FileContent } from '../job-creation/jobs';
import { TextShortenPipe } from '../text-shorten.pipe';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-column-specifying',
  imports: [CommonModule, TextShortenPipe, MatSelectModule, MatFormFieldModule],
  templateUrl: './column-specifying.component.html',
  styleUrl: './column-specifying.component.css'
})
export class ColumnSpecifyingComponent implements OnChanges {
  public columnNames = [
    'location',
    'variant',
    'chrom',
    'pos',
    'position_end',
    'position_begin',
    'ref',
    'alt',
    'cnv_type',
    'vcf_like',
  ];

  @Input() public fileContent: FileContent;
  @Output() public emitColumns = new EventEmitter<Map<string, string>>();
  public mappedColumns = new Map<string, string>();
  public error = '';

  public constructor() { }

  public ngOnChanges(): void {
    this.selectDefaultNames();
  }

  public onSelectName(selectedName: string, column: string): void {
    this.error = '';
    const newColumnName = this.getFileColumnNewName(column);
    if (selectedName === 'None' && newColumnName) {
      this.mappedColumns.delete(newColumnName);
      this.emitColumns.emit(this.mappedColumns);
      return;
    }
    if (newColumnName) {
      this.mappedColumns.delete(newColumnName);
    }
    this.mappedColumns.set(selectedName, column);
    this.emitColumns.emit(this.mappedColumns);
  }

  public getFileColumnNewName(column: string): string {
    for (const [key, value] of this.mappedColumns.entries()) {
      if (value === column) {
        return key;
      }
    }
    return null;
  }

  private selectDefaultNames(): void {
    this.fileContent.columns.forEach(fileHeader => {
      const lowerCasedHeader = fileHeader.toLocaleLowerCase();
      if (this.columnNames.includes(lowerCasedHeader)) {
        this.onSelectName(lowerCasedHeader, fileHeader);
      }
    });
  }
}
