import { Component, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { SingleAnnotationService } from '../single-annotation.service';
import { take } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-single-annotation',
  imports: [CommonModule, FormsModule],
  templateUrl: './single-annotation.component.html',
  styleUrl: './single-annotation.component.css'
})
export class SingleAnnotationComponent implements OnInit {
  public readonly environment = environment;
  public genomes: string[] = [];
  public selectedGenome: string = '';

  public constructor(
    private singleAnnotationService: SingleAnnotationService,
    private router: Router,
    private route: ActivatedRoute,
  ) { }

  public ngOnInit(): void {
    this.singleAnnotationService.getGenomes().pipe(take(1)).subscribe((genomes) => {
      this.genomes = genomes;
      this.selectedGenome = genomes[0];
    });
  }

  public loadReport(variant: string): void {
    this.router.navigate(
      [
        'report',
        { queryParams: {genome: this.selectedGenome, variant: variant}}
      ],
      { relativeTo: this.route }
    );
  }
}
