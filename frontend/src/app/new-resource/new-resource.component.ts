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
import { MatSelect } from '@angular/material/select';
import { distinctUntilChanged, map, switchMap, take } from 'rxjs';
import { KeyValueDisplayPipe } from '../key-value-display.pipe';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AnnotatorAttribute, Resource, ResourceAnnotator } from '../new-annotator/annotator';

@Component({
  selector: 'app-new-resource',
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
  templateUrl: './new-resource.component.html',
  styleUrl: './new-resource.component.css',
})

export class NewResourceComponent implements OnInit {
  public resourceStep: FormGroup<{ resourceType: FormControl<string>, resourceId: FormControl<string> }>;
  public resourceTypes: string[];
  public resourceIds: string[];
  public selectedType = '';
  public annotatorStep: FormGroup<{ annotatorType: FormControl<string> }>;
  public annotatorTypes: string[];
  public filteredAnnotatorTypes: string[];
  public resourceAnnotators: ResourceAnnotator[];
  public annotatorAttributes: AnnotatorAttribute[];
  public selectedAttributes: AnnotatorAttribute[];
  @ViewChild('stepper', { static: true }) public stepper: MatStepper;

  public constructor(
    private editorService: PipelineEditorService,
    private formBuilder: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public pipelineId: string,
  ) {
  }

  public ngOnInit(): void {
    this.resourceStep = this.formBuilder.group({
      resourceType: ['', Validators.required],
      resourceId: ['', Validators.required],
    });

    this.annotatorStep = this.formBuilder.group({
      annotatorType: ['', Validators.required],
    });

    this.editorService.getResourceTypes().pipe(take(1)).subscribe(res => {
      this.resourceTypes = res;
      this.selectedType = this.resourceTypes[0];
      this.setupResourceSearching();
    });
  }

  private setupResourceSearching(): void {
    this.resourceStep.get('resourceId').valueChanges.pipe(
      distinctUntilChanged(),
      map(value => this.normalizeString(value)),
      switchMap((value: string) => this.editorService.getResourcesBySearch(value, this.selectedType)),
    ).subscribe(resources => {
      this.resourceIds = resources;

      // eslint-disable-next-line @stylistic/max-len
      if (!resources.length || !this.resourceIds.includes(this.normalizeString(this.resourceStep.get('resourceId').value))) {
        this.resourceStep.get('resourceId').setErrors({ invalidOption: true });
      }
    });
  }

  public normalizeString(value: string): string {
    return value === null ? '' : value.trim();
  }

  public clearResource(): void {
    this.resourceStep.get('resourceId').setValue(null);
  }

  public requestAnnotators(): void {
    this.editorService.getResourceAnnotators(this.resourceStep.value.resourceId.trim()).pipe(
      take(1),
    ).subscribe(res => {
      this.annotatorTypes = res.map(r => r.annotatorType);
      this.filteredAnnotatorTypes = res.map(r => r.annotatorType);
      this.resourceAnnotators = res;

      this.setupAnnotatorValueFiltering();
      this.stepper.next();
    });
  }

  private setupAnnotatorValueFiltering(): void {
    this.annotatorStep.get('annotatorType').valueChanges.pipe(
      map((value: string) => this.filterDropdownContent(value, this.annotatorTypes))
    ).subscribe(filtered => {
      this.filteredAnnotatorTypes = filtered;
      if (!filtered.length || !filtered.includes(this.normalizeString(this.annotatorStep.get('annotatorType').value))) {
        this.annotatorStep.get('annotatorType').setErrors({ invalidOption: true });
      }
    });
  }

  private filterDropdownContent(value: string, options: string[]): string[] {
    if (!value) {
      return options;
    }
    const filterValue = value.toLowerCase().replace(/\s/g, '');
    return options.filter(p => p.toLowerCase().replace(/\s/g, '').includes(filterValue));
  }

  public clearAnnotator(): void {
    this.annotatorStep.get('annotatorType').setValue(null);
  }

  public requestAttributes(): void {
    this.editorService.getAnnotatorConfigForResource(
      this.annotatorStep.get('annotatorType').value,
      this.resourceAnnotators.find(a => a.annotatorType === this.annotatorStep.get('annotatorType').value).resourceJson
    )
      .pipe(
        switchMap(config => this.editorService.getAttributes(
          this.pipelineId,
          config.annotatorType,
          this.getResourcesWithValuesAsObject(config.resources)
        ))).subscribe(res => {
        this.annotatorAttributes = res;
        this.selectedAttributes = res.filter(a => a.selectedByDefault);
        this.stepper.next();
      });
  }

  private getResourcesWithValuesAsObject(resources: Resource[]): object {
    return Object.assign(
      {},
      ...resources.filter(r => r.defaultValue).map(r => ({ [r.key]: r.defaultValue}))
    ) as object;
  }
}
