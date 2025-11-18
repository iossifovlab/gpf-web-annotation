import { Component, Input } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SingleAnnotationReportComponent } from '../single-annotation-report/single-annotation-report.component';

@Component({
  selector: 'app-single-annotation',
  imports: [CommonModule, FormsModule, SingleAnnotationReportComponent],
  templateUrl: './single-annotation.component.html',
  styleUrl: './single-annotation.component.css'
})
export class SingleAnnotationComponent {
  @Input() public isMainComponent = true;
  public pipelineId = '';
  public readonly environment = environment;
  public validationMessage = '';

  public constructor(
    private router: Router,
  ) { }

  public loadReport(variant: string): void {
    this.router.navigateByUrl('/', { skipLocationChange: true })
      .then(() => this.router.navigate(
        ['/single-annotation/report'],
        {
          queryParams: { pipeline: this.pipelineId, variant: variant },
        },
      ));
  }

  public validateVariant(variant: string): void {
    variant = variant.trim();
    const v = variant.split(' ');
    let valid: boolean;
    if (v.length === 3) {
      valid = this.isPosValid(v[0]) && this.isRefValid(v[1]) && this.isAltValid(v[2]);
    } else if (v.length === 4) {
      valid = this.isPosValid(v[1]) && this.isRefValid(v[2]) && this.isAltValid(v[3]);
    } else {
      valid = false;
    }

    if (valid) {
      this.validationMessage = '';
      this.loadReport(variant);
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
