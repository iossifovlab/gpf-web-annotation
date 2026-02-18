import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewAnnotatorComponent } from './new-annotator.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { PipelineEditorService } from '../pipeline-editor.service';
import { AnnotatorAttribute, AnnotatorConfig, Resource } from './annotator';
import { FormBuilder, FormControl } from '@angular/forms';


const annotatorConfigMock = new AnnotatorConfig(
  'gene_set_annotator',
  [
    new Resource(
      'resource_id',
      'resource',
      'gene_score',
      '',
      ['gene_properties/gene_scores/LGD', 'gene_properties/gene_scores/RVIS'],
      false
    ),
    new Resource(
      'input_gene_list',
      'string',
      '',
      '',
      null,
      false
    ),
    new Resource(
      'source_genome',
      'resource',
      'genome',
      '',
      ['hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174', 'hg38/genomes/GRCh38-hg38', 'hg38/genomes/GRCh38.p13'],
      false
    )
  ]
);

const attributesMock = [
  new AnnotatorAttribute('attribute1', 'string', 'source1', false, true),
  new AnnotatorAttribute('attribute2', 'bool', 'source2', false, true),
  new AnnotatorAttribute('attribute3', 'string', 'source3', true, true)
];

const ymlResponse = `- gene_set_annotator:\n
  resource_id: gene_properties/gene_sets/autism\n
  input_gene_list: gene_list\n
  attributes:\n
  - "autism candidates from Iossifov PNAS 2015"\n
  - "autism candidates from Sanders Neuron 2015"\n 
  - "Yuen Scherer Nature 2017"\n
`;
class PipelineEditorServiceMock {
  public getAnnotators(): Observable<string[]> {
    return of(['effect_annotator', 'liftover_annotator', 'gene_set_annotator']);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getAnnotatorConfig(annotator: string): Observable<AnnotatorConfig> {
    return of(annotatorConfigMock);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getAttributes(pipelineId: string, annotator: string, resources: object): Observable<AnnotatorAttribute[]> {
    return of(attributesMock);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getAnnotatorYml(annotator: string, resources: object, attributes: AnnotatorAttribute[]): Observable<string> {
    return of(ymlResponse);
  }
}
class MatDialogRefMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public close(value: boolean): void { }
}

describe('NewAnnotatorComponent', () => {
  let component: NewAnnotatorComponent;
  let fixture: ComponentFixture<NewAnnotatorComponent>;
  const mockMatDialogRef = new MatDialogRefMock();
  const pipelineEditorServiceMock = new PipelineEditorServiceMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [NewAnnotatorComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: 'pipelineId' },
        { provide: MatDialogRef, useValue: mockMatDialogRef },
        { provide: PipelineEditorService, useValue: pipelineEditorServiceMock },
        provideHttpClient(),
        provideHttpClientTesting(),
        FormBuilder
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NewAnnotatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get attribute types on component initialization', () => {
    component.ngOnInit();
    expect(component.annotators).toStrictEqual(
      ['effect_annotator', 'liftover_annotator', 'gene_set_annotator']
    );
    expect(component.filteredAnnotators).toStrictEqual(
      ['effect_annotator', 'liftover_annotator', 'gene_set_annotator']
    );
    expect(component.annotatorStep).toBeDefined();
  });

  it('should get resources of an annotator', () => {
    component.requestResources();
    expect(component.annotatorConfig).toStrictEqual(annotatorConfigMock);
    expect(component.filteredResourceValues).toStrictEqual(
      new Map<string, string[]>([
        [
          'resource_id',
          ['gene_properties/gene_scores/LGD', 'gene_properties/gene_scores/RVIS']
        ],
        [
          'source_genome',
          ['hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174', 'hg38/genomes/GRCh38-hg38', 'hg38/genomes/GRCh38.p13']
        ]
      ]));
    expect(component.resourceStep).toBeDefined();
  });

  it('should get attributes', () => {
    component.resourceStep.setControl('resource_id', new FormControl('gene_properties/gene_scores/RVIS'));
    component.resourceStep.setControl('input_annotatable', new FormControl(null));
    component.annotatorStep.setControl('annotator', new FormControl('gene_set_annotator'));
    const getAttributesSpy = jest.spyOn(pipelineEditorServiceMock, 'getAttributes');
    const nextStepSpy = jest.spyOn(component.stepper, 'next');

    component.requestAttributes();
    expect(getAttributesSpy).toHaveBeenCalledWith(
      'pipelineId',
      'gene_set_annotator',
      // eslint-disable-next-line camelcase
      { resource_id: 'gene_properties/gene_scores/RVIS' }
    );
    expect(component.annotatorAttributes).toStrictEqual(attributesMock);
    expect(component.selectedAttributes).toStrictEqual(attributesMock);
    expect(nextStepSpy).toHaveBeenCalledWith();
  });

  it('should get final yaml text', () => {
    component.resourceStep.setControl('resource_id', new FormControl('gene_properties/gene_scores/RVIS'));
    component.resourceStep.setControl('input_annotatable', new FormControl(null));
    component.annotatorStep.setControl('annotator', new FormControl('gene_set_annotator'));
    const getAnnotatorYmlSpy = jest.spyOn(pipelineEditorServiceMock, 'getAnnotatorYml');
    const closeModalSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.selectedAttributes = [attributesMock[0]];

    component.onFinish();
    expect(getAnnotatorYmlSpy).toHaveBeenCalledWith(
      'gene_set_annotator',
      // eslint-disable-next-line camelcase
      { resource_id: 'gene_properties/gene_scores/RVIS' },
      [new AnnotatorAttribute('attribute1', 'string', 'source1', false, true)]
    );

    expect(closeModalSpy).toHaveBeenCalledWith('\n' + ymlResponse);
  });

  it('should clear annotator value in form', () => {
    component.annotatorStep.setControl('annotator', new FormControl('gene_set_annotator'));
    component.clearAnnotator();
    expect(component.annotatorStep.get('annotator').value).toBeNull();
  });

  it('should clear resource value in form', () => {
    component.resourceStep.setControl('resource_id', new FormControl('gene_properties/gene_scores/RVIS'));
    component.clearResource('resource_id');
    expect(component.resourceStep.get('resource_id').value).toBeNull();
  });

  it('should select attribute', () => {
    const attribute1 = new AnnotatorAttribute('attribute1', 'string', 'source1', false, true);
    const attribute2 = new AnnotatorAttribute('attribute2', 'bool', 'source2', false, true);
    const attribute3 = new AnnotatorAttribute('attribute3', 'string', 'source3', true, true);
    component.selectedAttributes = [attribute1, attribute2];
    component.toggleSelectedAttribute(attribute3);
    expect(component.selectedAttributes).toStrictEqual([attribute1, attribute2, attribute3]);
  });

  it('should unselect attribute', () => {
    const attribute1 = new AnnotatorAttribute('attribute1', 'string', 'source1', false, true);
    const attribute2 = new AnnotatorAttribute('attribute2', 'bool', 'source2', false, true);
    component.selectedAttributes = [attribute1, attribute2];
    component.toggleSelectedAttribute(attribute2);
    expect(component.selectedAttributes).toStrictEqual([attribute1]);
  });

  it('should toggle internal value of attribute', () => {
    const attribute = new AnnotatorAttribute('attribute', 'string', 'source1', false, true);
    component.selectedAttributes = [attribute];
    component.setAttributeInternal(attribute, true);
    expect(component.selectedAttributes[0].internal).toBe(true);
  });

  it('should change annotator input value and filter dropdown content', () => {
    component.annotators = ['effect_annotator', 'liftover_annotator', 'gene_set_annotator'];
    component.filteredAnnotators = ['effect_annotator', 'liftover_annotator', 'gene_set_annotator'];
    component.annotatorStep.get('annotator').setValue('LiFt  ');
    expect(component.filteredAnnotators).toStrictEqual(['liftover_annotator']);
  });

  it('should change annotator input value to invalid one and set error', () => {
    component.annotators = ['effect_annotator', 'liftover_annotator', 'gene_set_annotator'];
    component.filteredAnnotators = ['effect_annotator', 'liftover_annotator', 'gene_set_annotator'];
    component.annotatorStep.get('annotator').setValue('ewew');
    expect(component.filteredAnnotators).toStrictEqual([]);
    expect(component.annotatorStep.get('annotator').errors).toStrictEqual({invalidOption: true});
  });

  it('should change resource input value and filter dropdown content', () => {
    component.filteredResourceValues = new Map<string, string[]>([
      [
        'source_genome',
        ['hg19/genomes/GATK_ResourceBundle_5777_b37_phiX174', 'hg38/genomes/GRCh38-hg38', 'hg38/genomes/GRCh38.p13']
      ]
    ]);
    component.requestResources(); // trigger setup of resource form controls and filtering
    component.resourceStep.get('source_genome').setValue('grc');

    expect(component.filteredResourceValues.get('source_genome')).toStrictEqual(
      ['hg38/genomes/GRCh38-hg38', 'hg38/genomes/GRCh38.p13']
    );
    expect(component.resourceStep.get('source_genome').errors).toBeNull();
  });

  it('should change resource input value to invalid one and set error', () => {
    component.filteredResourceValues = new Map<string, string[]>([
      [
        'resource_id',
        ['gene_properties/gene_scores/LGD', 'gene_properties/gene_scores/RVIS']
      ]
    ]);
    component.requestResources(); // trigger setup of resource form controls and filtering
    component.resourceStep.get('resource_id').setValue('ewew');

    expect(component.filteredResourceValues.get('resource_id')).toStrictEqual([]);
    expect(component.resourceStep.get('resource_id').errors).toStrictEqual({invalidOption: true});
  });
});
