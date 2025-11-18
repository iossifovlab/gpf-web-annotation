import { Component, Input } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SingleAnnotationReportComponent } from '../single-annotation-report/single-annotation-report.component';

@Component({
  selector: 'app-single-annotation',
  imports: [CommonModule, FormsModule, SingleAnnotationReportComponent],
  templateUrl: './single-annotation.component.html',
  styleUrl: './single-annotation.component.css'
})
export class SingleAnnotationComponent {
  @Input() public pipelineId = '';
  public readonly environment = environment;
  public validationMessage = '';
  public showReport = false;
  public currentAlleleInput: string = '';
  public allele: string = '';

  public constructor() { }

  public validateVariant(): void {
    this.showReport = false;
    this.currentAlleleInput = this.currentAlleleInput.trim();
    const a = this.currentAlleleInput.split(' ');
    let valid: boolean;
    if (a.length === 3) {
      valid = this.isPosValid(a[0]) && this.isRefValid(a[1]) && this.isAltValid(a[2]);
    } else if (a.length === 4) {
      valid = this.isPosValid(a[1]) && this.isRefValid(a[2]) && this.isAltValid(a[3]);
    } else {
      valid = false;
    }

    if (valid) {
      this.validationMessage = '';
      this.showReport = true;
      this.allele = this.currentAlleleInput;
      this.currentAlleleInput = '';
    } else {
      this.validationMessage = 'Invalid variant format!';
    }
  }

  public isPosValid(position: string): boolean {
    return !isNaN(Number(position));
  }

  public isRefValid(reference: string): boolean {
    return reference !== '' && this.areBasesValid(reference);
  }

  private areBasesValid(bases: string): boolean {
    const validBases = ['A', 'C', 'G', 'T', 'N', 'a', 'c', 'g', 't', 'n'];
    const bList = bases.split('');
    return bList.filter(b => !validBases.includes(b)).length === 0;
  }

  public isAltValid(alternative: string): boolean {
    const aList = alternative.split(',');
    return aList.filter(a => !this.areBasesValid(a)).length === 0;
  }

  public setPipeline(newPipeline: string): void {
    this.pipelineId = newPipeline;
  }
}
