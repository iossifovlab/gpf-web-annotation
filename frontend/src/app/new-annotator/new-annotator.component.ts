import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { CdkStepperModule, STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { PipelineEditorService } from '../pipeline-editor.service';
import { map, Observable, of, switchMap, take } from 'rxjs';
import { AnnotatorAttribute, AnnotatorConfig, Resource } from './annotator';
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
  public selectedAttributes: AnnotatorAttribute[];
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

  private getInputAnnotatableValues(config: AnnotatorConfig): Observable<AnnotatorConfig> {
    const i = config.resources.findIndex(a => a.key === 'input_annotatable');
    if (i !== -1) {
      return this.editorService.getPipelineAttributes(this.pipelineId, 'annotatable').pipe(
        take(1),
        map(res => {
          config.resources[i] = new Resource(
            config.resources[i].key,
            config.resources[i].fieldType,
            config.resources[i].resourceType,
            config.resources[i].defaultValue,
            res,
            config.resources[i].optional
          );
          return config;
        })
      );
    }
    return of(config);
  }

  public requestResources(): void {
    this.editorService.getAnnotatorConfig(this.annotatorStep.value.annotator).pipe(
      take(1),
      switchMap(config => this.getInputAnnotatableValues(config))
    ).subscribe(res => {
      this.annotatorConfig = res;
      this.initializeFilteredResourceValues();
      this.setupResourceControls();
      this.stepper.next();
    });
  }

  private initializeFilteredResourceValues(): void {
    this.filteredResourceValues = new Map<string, string[]>();
    for (const resource of this.annotatorConfig.resources) {
      if (resource.fieldType === 'resource' || resource.key === 'input_annotatable') {
        this.filteredResourceValues.set(resource.key, resource.possibleValues);
      }
    }
  }

  private setupResourceControls(): void {
    const resourceGroup: Record<string, FormControl> = {};

    for (const resource of this.annotatorConfig.resources) {
      resourceGroup[resource.key] = new FormControl(
        resource.defaultValue ?? '',
        resource.optional ? Validators.nullValidator : Validators.required
      );
    }

    this.resourceStep = new FormGroup(resourceGroup);
    this.setupResourceValueFiltering();
  }

  private setupResourceValueFiltering(): void {
    // eslint-disable-next-line @stylistic/max-len
    this.annotatorConfig.resources.filter(r => r.fieldType === 'resource' || r.key === 'input_annotatable').forEach(resource => {
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
    if (!value) {
      return options;
    }
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
      this.selectedAttributes = res.filter(a => a.selectedByDefault);
      this.stepper.next();
    });
  }

  public onFinish(): void {
    const filtered = this.getPopulatedResourceValues();

    this.editorService.getAnnotatorYml(
      this.annotatorStep.value.annotator,
      filtered,
      this.selectedAttributes
    ).pipe(take(1)).subscribe(res => {
      this.dialogRef.close('\n' + res);
    });
  }

  private getPopulatedResourceValues(): object {
    return Object.fromEntries(
      Object.entries(this.resourceStep.value as object).filter(([, v]) => v !== null && v !== '')
    );
  }

  public clearAnnotator(): void {
    this.annotatorStep.get('annotator').setValue(null);
  }

  public clearResource(resource: string): void {
    this.resourceStep.get(resource).setValue(null);
  }

  public toggleSelectedAttribute(attribute: AnnotatorAttribute): void {
    if (this.selectedAttributes.includes(attribute)) {
      this.selectedAttributes = this.selectedAttributes.filter(a => a !== attribute);
    } else {
      this.selectedAttributes.push(attribute);
    }
  }

  public setAttributeInternal(attribute: AnnotatorAttribute, value: boolean): void {
    const index = this.selectedAttributes.findIndex(a => a.name === attribute.name);
    if (index !== -1) {
      this.selectedAttributes[index] = { ...this.selectedAttributes[index], internal: value };
    }
  }
}
