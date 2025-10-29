import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnSpecifyingModalComponent } from './column-specifying-modal.component';
import { MatDialogRef } from '@angular/material/dialog';
import { FileContent } from '../job-creation/jobs';
import { JobsService } from '../job-creation/jobs.service';
import { provideHttpClient } from '@angular/common/http';

const mockModalContent = new FileContent(
  ',',
  ['chrom', 'position', 'reference', 'alternative'],
  [
    ['chrom', 'position', 'reference', 'alternative'],
    ['chr1', '123', 'A', 'GG'],
  ]
);

class MatDialogRefMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public close(value: boolean): void { }
}

describe('ColumnSpecifyingModalComponent', () => {
  let component: ColumnSpecifyingModalComponent;
  let fixture: ComponentFixture<ColumnSpecifyingModalComponent>;
  const mockMatDialogRef = new MatDialogRefMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [ColumnSpecifyingModalComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockMatDialogRef },
        JobsService,
        provideHttpClient(),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ColumnSpecifyingModalComponent);
    component = fixture.componentInstance;
    component.fileContent = mockModalContent;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should check data', () => {
    const mappedFileContent: string[][] = [
      ['chrom', 'position', 'reference', 'alternative'],
      ['chr1', '123', 'A', 'GG'],
    ];
    expect(component.fileContent).toStrictEqual(new FileContent(
      ',',
      ['chrom', 'position', 'reference', 'alternative'],
      mappedFileContent
    ));
  });

  it('should map column to new name', () => {
    component.onSelectName('pos', 'position');
    expect(component.mappedColumns).toStrictEqual(new Map([
      ['pos', 'position']
    ]));
  });

  it('should map two columns to \'pos\'', () => {
    component.mappedColumns = new Map([
      ['pos', 'alternative']
    ]);
    component.onSelectName('pos', 'position');
    expect(component.mappedColumns).toStrictEqual(new Map([
      ['pos', 'position']
    ]));
  });

  it('should map \'chrom\' then \'alt\' to column from file', () => {
    component.onSelectName('chrom', 'alternative');

    component.onSelectName('alt', 'alternative');
    expect(component.mappedColumns).toStrictEqual(new Map([
      ['alt', 'alternative']
    ]));
  });

  it('should remove selected column name for file column', () => {
    component.mappedColumns = new Map([
      ['pos', 'alternative'],
      ['chrom', 'chr'],
    ]);

    component.onSelectName('None', 'alternative');
    expect(component.mappedColumns).toStrictEqual(new Map([
      ['chrom', 'chr'],
    ]));
  });
});
