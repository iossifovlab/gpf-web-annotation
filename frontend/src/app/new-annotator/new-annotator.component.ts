import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { CdkStepperModule, StepperSelectionEvent, STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { PipelineEditorService } from '../pipeline-editor.service';
import { map, take } from 'rxjs';
import { AnnotatorConfig } from './annotator';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-new-annotator',
  imports: [
    MatButtonModule,
    MatStepperModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    CommonModule,
    CdkStepperModule,
    MatAutocompleteModule
  ],
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: { showError: true }
    }
  ],
  templateUrl: './new-annotator.component.html',
  styleUrl: './new-annotator.component.css',
})
export class NewAnnotatorComponent implements OnInit {
  public selectedStepIndex = 0;
  public annotators: string[] = [];
  public filteredAnnotators: string[];
  public selectedAnnotator = '';
  public annotatorStep: FormGroup;
  public resourceStep: FormGroup = new FormGroup({});
  public annotatorConfig: AnnotatorConfig;
  @ViewChild('stepper', { static: true }) public stepper: MatStepper;

  public constructor(
    private editorService: PipelineEditorService,
    private formBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public pipelineId: string,
  ) {
  }

  public ngOnInit(): void {
    this.annotatorStep = this.formBuilder.group({
      annotator: ['', Validators.required],
    });

    const annotatorCtrl = this.annotatorStep.get('annotator');

    this.editorService.getAnnotators().subscribe(res => {
      this.annotators = res;
      this.filteredAnnotators = res;
    });

    annotatorCtrl.valueChanges.subscribe((value: string) => {
      if (!this.annotators.includes(value)) {
        this.annotatorStep.get('annotator').setErrors({ invalidOption: true });
        return;
      }
      this.selectedAnnotator = value;
    });

    annotatorCtrl.valueChanges.pipe(
      map((value: string) => this.filterAnnotators(value))
    ).subscribe(filtered => {
      this.filteredAnnotators = filtered;
    });
  }

  private filterAnnotators(value: string): string[] {
    const filterValue = value.toLowerCase().replace(/\s/g, '');
    return this.annotators.filter(p => p.toLowerCase().replace(/\s/g, '').includes(filterValue));
  }

  public onStepChanged(event: StepperSelectionEvent): void {
    this.selectedStepIndex = event.selectedIndex;
  }

  public requestResources(): void {
    this.editorService.getAnnotatorConfig(this.selectedAnnotator).pipe(take(1)).subscribe(res => {
      this.annotatorConfig = res;
      this.setupResourceControls();
      this.stepper.next();
    });
  }

  private setupResourceControls(): void {
    const resourceGroup: Record<string, FormControl> = {};

    for (const resource of this.annotatorConfig.resources) {
      resourceGroup[resource.key] = new FormControl(
        resource.defaultValue ?? '',
        Validators.required
      );
    }

    resourceGroup['inputAnnotatable'] = new FormControl();

    this.resourceStep = new FormGroup(resourceGroup);
  }

  public requestAttributes(): void {
    this.editorService.getAttributes(
      this.pipelineId,
      this.selectedAnnotator,
      new Map(Object.entries(this.resourceStep.value))
    ).pipe(take(1)).subscribe(res => {
      this.stepper.next();
    });
  }
}
