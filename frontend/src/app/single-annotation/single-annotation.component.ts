import { Component, EventEmitter, Output } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SingleAnnotationReportComponent } from '../single-annotation-report/single-annotation-report.component';
import { SingleAnnotationService } from '../single-annotation.service';
import { SingleAnnotationReport, Variant } from '../single-annotation';
import { UsersService } from '../users.service';
import { Subscription } from 'rxjs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-single-annotation',
  imports: [CommonModule, FormsModule, SingleAnnotationReportComponent, MatProgressSpinnerModule],
  templateUrl: './single-annotation.component.html',
  styleUrl: './single-annotation.component.css'
})
export class SingleAnnotationComponent {
  public readonly environment = environment;
  public validationMessage = '';
  public currentAllele: string = '';
  public report: SingleAnnotationReport = null;
  @Output() public alleleUpdateEmit = new EventEmitter<void>();
  @Output() public autoSaveTrigger = new EventEmitter<void>();
  private getReportSubscription = new Subscription();
  public loading = false;

  public constructor(private singleAnnotationService: SingleAnnotationService, private userService: UsersService) { }

  public triggerPipelineAutoSave(): void {
    this.autoSaveTrigger.emit();
  }

  public annotateAllele(pipelineId: string): void {
    if (this.isAlleleValid() && pipelineId) {
      this.validationMessage = '';
      this.getReport(pipelineId);
    } else {
      this.validationMessage = 'Invalid allele format!';
      this.report = null;
    }
  }

  private isAlleleValid(): boolean {
    this.currentAllele = this.currentAllele.trim();
    const a = this.currentAllele.split(' ');

    let valid = false;
    if (a.length === 3) {
      valid = this.isPosValid(a[0]) && this.isRefValid(a[1]) && this.isAltValid(a[2]);
    } else if (a.length === 4) {
      valid = this.isPosValid(a[1]) && this.isRefValid(a[2]) && this.isAltValid(a[3]);
    }

    return valid;
  }

  private isPosValid(position: string): boolean {
    return !isNaN(Number(position));
  }

  private isRefValid(reference: string): boolean {
    return reference !== '' && this.areBasesValid(reference);
  }

  private areBasesValid(bases: string): boolean {
    const validBases = ['A', 'C', 'G', 'T', 'N', 'a', 'c', 'g', 't', 'n'];
    const bList = bases.split('');
    return bList.filter(b => !validBases.includes(b)).length === 0;
  }

  private isAltValid(alternative: string): boolean {
    const aList = alternative.split(',');
    return aList.filter(a => !this.areBasesValid(a)).length === 0;
  }

  public setAllele(historyAllele: string): void {
    this.currentAllele = historyAllele;
  }

  public resetReport(): void {
    this.report = null;
  }

  private getReport(pipelineId: string): void {
    this.getReportSubscription.unsubscribe();
    this.loading = true;
    this.getReportSubscription = this.singleAnnotationService.getReport(
      this.parseVariantToObject(this.currentAllele),
      pipelineId
    ).subscribe(report => {
      this.loading = false;
      this.report = report;
      this.triggerAllelesTableUpdate();
    });
  }

  private triggerAllelesTableUpdate(): void {
    this.userService.userData.pipe(
    ).subscribe((userData) => {
      if (userData) {
        this.alleleUpdateEmit.emit();
      }
    });
  }

  private parseVariantToObject(variant: string): Variant {
    const variantFields = variant.split(' ');
    return new Variant(variantFields[0], Number(variantFields[1]), variantFields[2], variantFields[3], null);
  }
}
