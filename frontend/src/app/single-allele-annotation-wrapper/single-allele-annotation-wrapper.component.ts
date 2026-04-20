import { Component, ViewChild, OnInit, NgZone, HostListener } from '@angular/core';
import { take } from 'rxjs';
import { AnnotationPipelineComponent } from '../annotation-pipeline/annotation-pipeline.component';
import { CommonModule } from '@angular/common';
import { SingleAnnotationComponent } from '../single-annotation/single-annotation.component';
import { AllelesTableComponent } from '../alleles-table/alleles-table.component';
import { UsersService } from '../users.service';
import { AnnotationPipelineService } from '../annotation-pipeline.service';

@Component({
  selector: 'app-single-allele-annotation-wrapper',
  imports: [
    CommonModule,
    AnnotationPipelineComponent,
    SingleAnnotationComponent,
    AllelesTableComponent,
  ],
  templateUrl: './single-allele-annotation-wrapper.component.html',
  styleUrl: './single-allele-annotation-wrapper.component.css'
})

export class SingleAlleleAnnotationWrapperComponent implements OnInit {
  public pipelineId = '';
  public isConfigValid = true;
  public creationError = '';
  @ViewChild(AnnotationPipelineComponent) public pipelinesComponent: AnnotationPipelineComponent;
  @ViewChild(AllelesTableComponent) public allelesTableComponent: AllelesTableComponent;
  @ViewChild(SingleAnnotationComponent) public singleAnnotationComponent: SingleAnnotationComponent;
  public hideComponents = false;
  public hideHistory = false;
  public isUserLoggedIn = false;


  public constructor(
      private userService: UsersService,
      private ngZone: NgZone,
      private annotationPipelineService: AnnotationPipelineService,
  ) { }

  public ngOnInit(): void {
    this.userService.userData.pipe(
    ).subscribe((userData) => {
      this.isUserLoggedIn = userData.loggedIn;
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  public beforeUnload(event: BeforeUnloadEvent): void {
    if (this.pipelinesComponent.isPipelineChanged()) {
      event.preventDefault(); // display the confirmation dialog
    }
  }

  public autoSavePipeline(): void {
    if (!this.isConfigValid) {
      return;
    }
    if (this.pipelinesComponent.isPipelineChanged()) {
      this.pipelinesComponent.autoSave().pipe(take(1)).subscribe(annonymousPipelineName => {
        this.pipelineId = annonymousPipelineName;
        this.annotate();
      });
    } else {
      this.annotate();
    }
  }

  private annotate(): void {
    this.singleAnnotationComponent.pipelineId = this.pipelineId;
    this.singleAnnotationComponent.annotateAllele();
  }

  public triggerSingleAlleleAnnotation(allele: string): void {
    this.singleAnnotationComponent.setAllele(allele);
    this.autoSavePipeline();
  }

  public setPipeline(newPipeline: string): void {
    if (!newPipeline || this.pipelineId === newPipeline) {
      return;
    }
    this.resetSingleAlleleReport();
    this.pipelineId = newPipeline;

    if (newPipeline) {
      this.annotationPipelineService.loadPipeline(newPipeline).pipe(take(1)).subscribe();
    }
  }

  public resetSingleAlleleReport(): void {
    this.singleAnnotationComponent?.resetReport();
  }

  public setConfigValid(newState: boolean): void {
    if (this.isConfigValid === newState) {
      return;
    }
    this.resetSingleAlleleReport();
    this.isConfigValid = newState;
  }

  public refreshAllelesTable(): void {
    this.allelesTableComponent.refreshTable();
  }

  public updateComponentsVisibility(toHide: boolean): void {
    this.ngZone.run(() => {
      this.hideComponents = toHide;
      this.hideHistory = toHide;
    });
  }

  public showComponents(): void {
    this.updateComponentsVisibility(false);
    this.pipelinesComponent.shrinkTextarea();
  }

  public refreshUserQuota(): void {
    this.userService.refreshUserData();
  }
}
