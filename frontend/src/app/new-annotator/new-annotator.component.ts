import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { CdkStepperModule, STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { PipelineEditorService } from '../pipeline-editor.service';
import { map, Observable, of, switchMap, take, forkJoin, Subject, distinctUntilChanged, tap } from 'rxjs';
import { AnnotatorAttribute, AnnotatorConfig, Resource, ResourceAnnotator } from './annotator';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { KeyValueDisplayPipe } from '../key-value-display.pipe';
import { MatSelect } from '@angular/material/select';

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
    MatSelect,
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
  public resourceTypeStep: FormGroup<{ resourceType: FormControl<string>, resourceId: FormControl<string> }>;
  public resourceTypes: string[];
  public resourceIds: string[];
  public selectedResourceType = '';
  private searchSubject = new Subject<{ value: string; type: string }>();
  public resourceAnnotators: ResourceAnnotator[];

  public annotatorStep: FormGroup<{ annotator: FormControl<string> }>;
  public annotatorTypes: string[] = [];
  public filteredAnnotatorTypes: string[];
  public resourceStep: FormGroup = new FormGroup({});
  public filteredResourceValues: Map<string, string[]>;
  public annotatorConfig: AnnotatorConfig;
  public attributeStep: FormGroup<{ attribute: FormControl<string> }>;
  public annotatorAttributes: AnnotatorAttribute[];
  public selectedAttributes: AnnotatorAttribute[];
  public unselectedAttributes: string[];
  public unselectedFilteredAttributes: string[];
  public areAttributesValid: boolean;
  @ViewChild('stepper', { static: true }) public stepper: MatStepper;
  public duplicateAttributeNames: string[] = [];

  public constructor(
    private editorService: PipelineEditorService,
    private formBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: {pipelineId: string, isResourceWorkflow: boolean},
    private dialogRef: MatDialogRef<NewAnnotatorComponent>
  ) {
  }

  public ngOnInit(): void {
    this.annotatorStep = this.formBuilder.group({
      annotator: ['', Validators.required],
    });

    if (this.data.isResourceWorkflow) {
      this.resourceTypeStep = this.formBuilder.group({
        resourceType: ['', Validators.required],
        resourceId: ['', Validators.required],
      });

      this.editorService.getResourceTypes().pipe(take(1)).subscribe(res => {
        this.resourceTypes = res;
        this.selectedResourceType = this.resourceTypes[0];
        this.resourceTypeStep.get('resourceType').setValue(this.selectedResourceType, { emitEvent: false });
        this.setupResourceSearching();
      });
    } else {
      this.requestAnnotators();
    }
  }

  private setupResourceSearching(): void {
    // Set up the search subject to handle API calls
    this.searchSubject.pipe(
      distinctUntilChanged((prev, curr) => prev.value === curr.value && prev.type === curr.type),
      switchMap(({ value, type }) => this.editorService.getResourcesBySearch(value, type)),
    ).subscribe(resources => {
      this.resourceIds = resources;

      if (!this.resourceIds.includes(this.normalizeString(this.resourceTypeStep.get('resourceId').value))) {
        this.resourceTypeStep.get('resourceId').setErrors({ invalidOption: true });
      } else {
        this.resourceTypeStep.get('resourceId').setErrors(null);
      }
    });

    // Trigger search on resourceId value changes
    this.resourceTypeStep.get('resourceId').valueChanges.pipe(
      tap(() => this.resourceTypeStep.get('resourceId').setErrors({ invalidOption: true })),
      map(value => ({ value: this.normalizeString(value), type: this.selectedResourceType })),
    ).subscribe(obj => this.searchSubject.next(obj));

    // Trigger search when resourceType changes
    this.resourceTypeStep.get('resourceType').valueChanges.subscribe(type => {
      this.selectedResourceType = type;
      this.searchSubject.next({ value: '', type: type });
    });
  }


  private requestAnnotators(): void {
    this.editorService.getAnnotators().subscribe(res => {
      this.annotatorTypes = res;
      this.filteredAnnotatorTypes = res;
      this.setupAnnotatorValueFiltering();
    });
  }

  public requestResourceAnnotators(): void {
    this.editorService.getResourceAnnotators(this.resourceTypeStep.value.resourceId.trim()).pipe(
      take(1),
    ).subscribe(res => {
      this.resourceAnnotators = res;
      this.annotatorTypes = res.map(r => r.annotatorType);
      this.filteredAnnotatorTypes = res.map(r => r.annotatorType);
      this.setupAnnotatorValueFiltering();
      if (this.resourceAnnotators.length === 1) {
        this.autoSelectAnnotator();
      }
      this.stepper.next();
    });
  }

  private autoSelectAnnotator(): void {
    this.annotatorStep.get('annotator').setValue(this.resourceAnnotators[0].annotatorType);
    this.requestResources();
  }

  private setupAnnotatorValueFiltering(): void {
    this.annotatorStep.get('annotator').valueChanges.pipe(
      map((value: string) => this.filterDropdownContent(value, this.annotatorTypes))
    ).subscribe(filtered => {
      this.filteredAnnotatorTypes = filtered;
      if (!filtered.includes(this.normalizeString(this.annotatorStep.get('annotator').value))) {
        this.annotatorStep.get('annotator').setErrors({ invalidOption: true });
      }
    });
  }

  public normalizeString(value: string): string {
    return value === null ? '' : value.trim();
  }

  private getPipelineAttributes(config: AnnotatorConfig): Observable<AnnotatorConfig> {
    const attributeResources = config.resources.filter(r => r.fieldType === 'attribute');

    if (attributeResources.length === 0) {
      return of(config);
    }

    const observables = attributeResources.map(resource =>
      this.editorService.getPipelineAttributes(this.data.pipelineId, resource.attributeType).pipe(
        take(1),
        map(res => {
          const resourceIndex = config.resources.findIndex(r => r.key === resource.key);
          if (resourceIndex !== -1) {
            config.resources[resourceIndex] = new Resource(
              resource.key,
              resource.fieldType,
              resource.resourceType,
              resource.defaultValue,
              res,
              resource.optional,
              resource.attributeType
            );
          }
        })
      )
    );

    return forkJoin(observables).pipe(map(() => config));
  }

  public requestResources(): void {
    let annotatorConfigObservable = this.editorService.getAnnotatorConfig(
      this.normalizeString(this.annotatorStep.value.annotator));

    if (this.data.isResourceWorkflow) {
      annotatorConfigObservable = this.editorService.getAnnotatorConfig(
        this.annotatorStep.get('annotator').value,
        this.resourceAnnotators.find(a => a.annotatorType === this.annotatorStep.get('annotator').value).resourceJson
      );
    }

    annotatorConfigObservable.pipe(
      take(1),
      switchMap(config => this.getPipelineAttributes(config))
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
      if (resource.fieldType === 'resource' || resource.fieldType === 'attribute') {
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
    this.annotatorConfig.resources.filter(r => r.fieldType === 'resource' || r.fieldType === 'attribute').forEach(resource => {
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
      this.data.pipelineId,
      this.annotatorStep.value.annotator,
      filtered
    ).pipe(take(1)).subscribe(res => {
      this.annotatorAttributes = res;
      this.selectedAttributes = res.filter(a => a.selectedByDefault);
      this.unselectedAttributes = res.filter(a => !a.selectedByDefault).map(a => `${a.name} - ${a.description}`);
      this.unselectedFilteredAttributes = this.unselectedAttributes;
      this.setupAttributeValueFiltering();
      this.getPipelineAttributesNames();
      this.stepper.next();
    });
  }

  private setupAttributeValueFiltering(): void {
    this.attributeStep = this.formBuilder.group({
      attribute: [''],
    });

    this.attributeStep.get('attribute').valueChanges.pipe(
      map((value: string) => this.filterDropdownContent(value, this.unselectedAttributes))
    ).subscribe(filtered => {
      this.unselectedFilteredAttributes = filtered;
    });
  }

  private getPipelineAttributesNames(): void {
    this.editorService.getPipelineAttributesNames(this.data.pipelineId).pipe(take(1)).subscribe(names => {
      this.duplicateAttributeNames = this.annotatorAttributes.filter(a => names.includes(a.name)).map(a => a.name);
      this.validateAttributes();
    });
  }

  public validateAttributes(): void {
    this.areAttributesValid = !this.annotatorAttributes.some(
      a => this.selectedAttributes.includes(a) && this.duplicateAttributeNames.includes(a.name)
    );
  }

  public onFinish(): void {
    const filtered = this.getPopulatedResourceValues();

    this.editorService.getAnnotatorYml(
      this.data.pipelineId,
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

  public clearAttributeInput(): void {
    this.attributeStep.get('attribute').setValue(null);
  }

  public clearResource(inputField?: string): void {
    if (inputField) {
      this.resourceStep.get(inputField).setValue(null);
      return;
    }
    this.resourceTypeStep.get('resourceId').setValue(null);
  }

  public setAttributeInternal(attribute: AnnotatorAttribute, value: boolean): void {
    const index = this.selectedAttributes.findIndex(a => a.name === attribute.name);
    if (index !== -1) {
      this.selectedAttributes[index].internal = value;
    }
  }

  public onSelectAttribute(stringAttribute: string): void {
    const attributeName = stringAttribute.split(' - ')[0];
    this.selectedAttributes.push(this.annotatorAttributes.find(a => a.name === attributeName));
    this.unselectedAttributes = this.unselectedAttributes.filter(a => a !== stringAttribute);
    this.clearAttributeInput();
    this.validateAttributes();
  }

  public removeSelectedAttribute(attribute: AnnotatorAttribute): void {
    this.selectedAttributes = this.selectedAttributes.filter(a => a !== attribute);
    this.unselectedAttributes.push(`${attribute.name} - ${attribute.description}`);
    this.validateAttributes();
  }
}
