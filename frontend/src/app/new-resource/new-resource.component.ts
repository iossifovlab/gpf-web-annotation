import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { CdkStepperModule, STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { PipelineEditorService } from '../pipeline-editor.service';
import { MatSelect } from '@angular/material/select';
import { switchMap } from 'rxjs';

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
    MatSelect
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
  public resourceStep: FormGroup<{ type: FormControl<string>, resourceInput: FormControl<string> }>;
  public resourceTypes: string[];
  public resourceIds: string[];
  public selectedType = '';

  public constructor(
    private editorService: PipelineEditorService,
    private formBuilder: FormBuilder,
  ) {
  }

  public ngOnInit(): void {
    this.resourceStep = this.formBuilder.group({
      type: ['', Validators.required],
      resourceInput: ['', Validators.required],
    });

    this.editorService.getResourceTypes().subscribe(res => {
      this.resourceTypes = res;
      this.selectedType = this.resourceTypes[0];
      this.setupResourceSearching();
    });
  }

  private setupResourceSearching(): void {
    this.resourceStep.get('resourceInput').valueChanges.pipe(
      switchMap((value: string) => this.editorService.getResourcesBySearch(value, this.selectedType))
    ).subscribe(resources => {
      this.resourceIds = resources;

      if (!this.resourceIds.length || !this.resourceIds.includes(this.resourceStep.get('resourceInput').value)) {
        this.resourceStep.get('resourceInput').setErrors({ invalidOption: true });
      }
    });
  }
}
