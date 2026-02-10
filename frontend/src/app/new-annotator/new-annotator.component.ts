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
import { AnnotatorAttribute, AnnotatorConfig } from './annotator';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { KeyValueDisplayPipe } from '../key-value-display.pipe';

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
    MatAutocompleteModule,
    KeyValueDisplayPipe
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
  public filteredResourceValues: Map<string, string[]>;
  public annotatorStep: FormGroup<{ annotator: FormControl<string> }>;
  public resourceStep: FormGroup = new FormGroup({});
  public annotatorConfig: AnnotatorConfig;
  public annotatorAttributes: AnnotatorAttribute[];
  @ViewChild('stepper', { static: true }) public stepper: MatStepper;

  public constructor(
    private editorService: PipelineEditorService,
    private formBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public pipelineId: string,
    private dialogRef: MatDialogRef<NewAnnotatorComponent>
  ) {
  }

  public ngOnInit(): void {
    this.annotatorStep = this.formBuilder.group({
      annotator: ['', Validators.required],
    });

    this.editorService.getAnnotators().subscribe(res => {
      this.annotators = res;
      this.filteredAnnotators = res;
      this.setupAnnotatorValueFiltering();
    });
  }

  private setupAnnotatorValueFiltering(): void {
    this.annotatorStep.get('annotator').valueChanges.pipe(
      map((value: string) => this.filterDropdownContent(value, this.annotators))
    ).subscribe(filtered => {
      this.filteredAnnotators = filtered;
      if (!filtered.length) {
        this.annotatorStep.get('annotator').setErrors({ invalidOption: true });
      }
    });
  }

  public onStepChanged(event: StepperSelectionEvent): void {
    this.selectedStepIndex = event.selectedIndex;
  }

  public requestResources(): void {
    this.editorService.getAnnotatorConfig(this.annotatorStep.value.annotator).pipe(take(1)).subscribe(res => {
      this.annotatorConfig = res;
      this.initializeFilteredResourceValues();
      this.setupResourceControls();
      this.stepper.next();
    });
  }

  private initializeFilteredResourceValues(): void {
    this.filteredResourceValues = new Map<string, string[]>();
    for (const resource of this.annotatorConfig.resources) {
      if (resource.fieldType === 'resource') {
        this.filteredResourceValues.set(resource.key, resource.possibleValues);
      }
    }
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
    this.setupResourceValueFiltering();
  }

  private setupResourceValueFiltering(): void {
    this.annotatorConfig.resources.filter(r => r.fieldType === 'resource').forEach(resource => {
      this.resourceStep.get(resource.key).valueChanges.pipe(
        map((value: string) => this.filterDropdownContent(value, resource.possibleValues))
      ).subscribe(filtered => {
        this.filteredResourceValues.set(resource.key, filtered);
        if (!filtered.length) {
          this.resourceStep.get(resource.key).setErrors({ invalidOption: true });
        }
      });
    });
  }

  private filterDropdownContent(value: string, options: string[]): string[] {
    const filterValue = value.toLowerCase().replace(/\s/g, '');
    return options.filter(p => p.toLowerCase().replace(/\s/g, '').includes(filterValue));
  }

  public requestAttributes(): void {
    const filtered = this.getPopulatedResourceValues();

    this.editorService.getAttributes(
      this.pipelineId,
      this.annotatorStep.value.annotator,
      filtered
    ).pipe(take(1)).subscribe(res => {
      this.annotatorAttributes = res;
      this.stepper.next();
    });
  }

  public onFinish(): void {
    const filtered = this.getPopulatedResourceValues();

    this.editorService.getAnnotatorYml(
      this.annotatorStep.value.annotator,
      filtered,
      this.annotatorAttributes
    ).pipe(take(1)).subscribe(res => {
      this.dialogRef.close(res);
    });
  }

  public getPopulatedResourceValues(): object {
    return Object.fromEntries(
      Object.entries(this.resourceStep.value as object).filter(([, v]) => v !== null)
    );
  }
}
