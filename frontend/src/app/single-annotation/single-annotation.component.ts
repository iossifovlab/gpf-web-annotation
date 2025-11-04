import { Component, Input, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { SingleAnnotationService } from '../single-annotation.service';
import { take } from 'rxjs';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-single-annotation',
  imports: [CommonModule, FormsModule],
  templateUrl: './single-annotation.component.html',
  styleUrl: './single-annotation.component.css'
})
export class SingleAnnotationComponent implements OnInit {
  @Input() public isMainComponent = true;
  public readonly environment = environment;
  public genomes: string[] = [];
  public selectedGenome: string = '';
  public validationMessage = '';

  public constructor(
    private singleAnnotationService: SingleAnnotationService,
    private router: Router,
  ) { }

  public ngOnInit(): void {
    this.singleAnnotationService.getGenomes().pipe(take(1)).subscribe((genomes) => {
      this.genomes = genomes;
      this.selectedGenome = genomes[0];
    });
  }

  public loadReport(variant: string): void {
    this.router.navigate(
      ['report'],
      { queryParams: { genome: this.selectedGenome, variant: variant }, relativeTo: this.route },
    );
  }

  public validateVariant(variant: string): void {
    variant = variant.trim();
    const v = variant.split(' ');
    if (
      v.length === 4 &&
      this.isChromValid(v[0]) &&
      this.isPosValid(v[1]) &&
      this.isRefValid(v[2]) &&
      this.isAltValid(v[3])
    ) {
      this.validationMessage = '';
      this.loadReport(variant);
    } else {
      this.validationMessage = 'Invalid variant format!';
    }
  }

  public isChromValid(chromosome: string): boolean {
    let chromRegex = '(2[0-2]|1[0-9]|[0-9]|X|Y)';
    if (this.selectedGenome === 'hg38') {
      chromRegex = 'chr' + chromRegex;
    }
    const lineRegex = `${chromRegex}`;
    const match = chromosome.match(new RegExp(lineRegex, 'i'));
    return match !== null && match[0] === chromosome;
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
}
