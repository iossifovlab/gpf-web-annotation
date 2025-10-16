import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnSpecifyingModalComponent } from './column-specifying-modal.component';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FileContent } from '../job-creation/jobs';

const mockModalContent = new FileContent(
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
        { provide: MAT_DIALOG_DATA, useValue: mockModalContent },
        { provide: MatDialogRef, useValue: mockMatDialogRef },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ColumnSpecifyingModalComponent);
    component = fixture.componentInstance;
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
      ['chrom', 'position', 'reference', 'alternative'],
      mappedFileContent
    ));
  });
});
