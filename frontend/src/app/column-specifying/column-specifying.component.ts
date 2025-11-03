import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
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
export class ColumnSpecifyingComponent {
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

  public onSelectName(selectedName: string, column: string): void {
    this.error = '';
    const key = this.getFileColumnKey(column);
    if (selectedName === 'None' && key) {
      this.mappedColumns.delete(key);
      return;
    }
    if (key) {
      this.mappedColumns.delete(key);
    }
    this.mappedColumns.set(selectedName, column);
    this.emitColumns.emit(this.mappedColumns);
  }

  private getFileColumnKey(column: string): string {
    for (const [key, value] of this.mappedColumns.entries()) {
      if (value === column) {
        return key;
      }
    }
    return null;
  }
}
