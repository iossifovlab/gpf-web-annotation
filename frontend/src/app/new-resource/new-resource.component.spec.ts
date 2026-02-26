import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewResourceComponent } from './new-resource.component';
import { provideHttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AnnotatorAttribute, AnnotatorConfig, Resource, ResourceAnnotator } from '../new-annotator/annotator';
import { FormControl } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { PipelineEditorService } from '../pipeline-editor.service';

const annotatorConfigMock = new AnnotatorConfig(
  'effect_annotator',
  [
    new Resource(
      'gene_models',
      'resource',
      'gene_models',
      'hg19/gene_models/ccds_v201309',
      [
        'hg19/gene_models/refGene_v20190211',
        'hg38/gene_models/GENCODE/34/basic/ALL',
        'hg38/gene_models/GENCODE/34/basic/CHR"'
      ],
      false,
      ''
    ),
    new Resource(
      'genome',
      'resource',
      'genome',
      '',
      ['hg38/genomes/GRCh38.p14', 't2t/genomes/t2t-chm13v2.0'],
      true,
      ''
    ),
    new Resource(
      'input_annotatable',
      'attribute',
      '',
      '',
      ['normalized_allele', 'hg19_annotatable'],
      true,
      'annotatable'
    )
  ]
);

const attributesMock = [
  new AnnotatorAttribute('attribute1', 'string', 'source1', false, true),
  new AnnotatorAttribute('attribute2', 'bool', 'source2', false, true),
  new AnnotatorAttribute('attribute3', 'string', 'source3', true, true)
];

const ymlResponse = `
- effect_annotator:\n
    genome: t2t/genomes/t2t-chm13v2.0\n
    gene_models: hg19/gene_models/ccds_v201309\n
    attributes:\n
    - internal: false\n
      name: worst_effect\n
      source: worst_effect\n
    - internal: false\n
      name: worst_effect_genes\n
      source: worst_effect_genes\n
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getPipelineAttributes(pipelineId: string, attributeType: string,): Observable<string[]> {
    return of(['normalized_allele', 'hg19_annotatable']);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getResourceTypes(): Observable<string[]> {
    return of(['gene_set_collection', 'position_score', 'genome']);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getResourcesBySearch(value: string, type: string): Observable<string[]> {
    return of([
      'hg19/scores/phyloP46_primates',
      'hg19/scores/phyloP46_vertebrates',
      'hg38/scores/phastCons100way',
      'hg38/scores/phastCons20way'
    ].filter(r => r.includes(value)));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getResourceAnnotators(resourceId: string): Observable<ResourceAnnotator[]> {
    return of([
      new ResourceAnnotator('effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309'),
      new ResourceAnnotator('simple_effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309')
    ]);
  }
}
class MatDialogRefMock {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public close(value: boolean): void { }
}
describe('NewResourceComponent', () => {
  let component: NewResourceComponent;
  let fixture: ComponentFixture<NewResourceComponent>;
  const mockMatDialogRef = new MatDialogRefMock();
  const pipelineEditorServiceMock = new PipelineEditorServiceMock();

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [NewResourceComponent],
      providers: [
        provideHttpClient(),
        { provide: MAT_DIALOG_DATA, useValue: 'pipelineId' },
        { provide: MatDialogRef, useValue: mockMatDialogRef },
        { provide: PipelineEditorService, useValue: pipelineEditorServiceMock },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NewResourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get resource types on component initialization', () => {
    expect(component.resourceTypes).toStrictEqual(['gene_set_collection', 'position_score', 'genome']);
    expect(component.selectedType).toBe('gene_set_collection');
    expect(component.resourceTypeStep.get('resourceType').value).toBe('gene_set_collection');
  });

  it('should trigger search on resource type change', () => {
    const searchSpy = jest.spyOn(pipelineEditorServiceMock, 'getResourcesBySearch');
    component.resourceTypeStep.get('resourceType').setValue('genome', { emitEvent: true });
    expect(searchSpy).toHaveBeenCalledWith('', 'genome');
    expect(component.resourceIds).toStrictEqual([
      'hg19/scores/phyloP46_primates',
      'hg19/scores/phyloP46_vertebrates',
      'hg38/scores/phastCons100way',
      'hg38/scores/phastCons20way'
    ]);
    expect(component.resourceTypeStep.get('resourceId').errors).toStrictEqual({invalidOption: true});
  });

  it('should trigger search on resource input change', () => {
    const searchSpy = jest.spyOn(pipelineEditorServiceMock, 'getResourcesBySearch');
    const normalizeStringSpy = jest.spyOn(component, 'normalizeString');
    component.resourceTypeStep.get('resourceId').setValue('hg38  ', { emitEvent: true });
    expect(normalizeStringSpy).toHaveBeenCalledWith('hg38  ');
    expect(searchSpy).toHaveBeenCalledWith('hg38', 'gene_set_collection');
    expect(component.resourceIds).toStrictEqual(['hg38/scores/phastCons100way', 'hg38/scores/phastCons20way']);
    expect(component.resourceTypeStep.get('resourceId').errors).toStrictEqual({invalidOption: true});
  });

  it('should make resource id form valid if the typed resource exists', () => {
    const searchSpy = jest.spyOn(pipelineEditorServiceMock, 'getResourcesBySearch');
    const normalizeStringSpy = jest.spyOn(component, 'normalizeString');
    component.resourceTypeStep.get('resourceId').setValue('hg38/scores/phastCons20way', { emitEvent: true });
    expect(normalizeStringSpy).toHaveBeenCalledWith('hg38/scores/phastCons20way');
    expect(searchSpy).toHaveBeenCalledWith('hg38/scores/phastCons20way', 'gene_set_collection');
    expect(component.resourceIds).toStrictEqual(['hg38/scores/phastCons20way']);
    expect(component.resourceTypeStep.get('resourceId').errors).toBeNull();
  });

  it('should not trigger search when the search value has not changed', () => {
    jest.clearAllMocks(); // clear search method calls from previous tests
    const searchSpy = jest.spyOn(pipelineEditorServiceMock, 'getResourcesBySearch');
    component.resourceTypeStep.get('resourceId').setValue('hg38  ', { emitEvent: true });
    expect(searchSpy).toHaveBeenCalledTimes(1);
    component.resourceTypeStep.get('resourceId').setValue('hg38', { emitEvent: true });
    expect(searchSpy).toHaveBeenCalledTimes(1);
  });

  it('should normalize strings', () => {
    expect(component.normalizeString('aaaa     ')).toBe('aaaa');
    expect(component.normalizeString('   aaaa     ')).toBe('aaaa');
    expect(component.normalizeString(null)).toBe('');
  });

  it('should request annotators based on selected resource', () => {
    component.requestAnnotators();
    expect(component.resourceAnnotators).toStrictEqual([
      new ResourceAnnotator('effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309'),
      new ResourceAnnotator('simple_effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309')
    ]);
    expect(component.annotatorTypes).toStrictEqual(['effect_annotator', 'simple_effect_annotator']);
    expect(component.filteredAnnotatorTypes).toStrictEqual(['effect_annotator', 'simple_effect_annotator']);
  });

  it('should request annotators and search annotator', () => {
    component.requestAnnotators();
    expect(component.resourceAnnotators).toStrictEqual([
      new ResourceAnnotator('effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309'),
      new ResourceAnnotator('simple_effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309')
    ]);

    component.annotatorStep.get('annotator').setValue('sim');
    expect(component.filteredAnnotatorTypes).toStrictEqual(['simple_effect_annotator']);
    expect(component.annotatorStep.get('annotator').errors).toStrictEqual({invalidOption: true});
  });

  it('should request annotators and type existing annotator', () => {
    component.requestAnnotators();
    expect(component.resourceAnnotators).toStrictEqual([
      new ResourceAnnotator('effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309'),
      new ResourceAnnotator('simple_effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309')
    ]);

    component.annotatorStep.get('annotator').setValue('simple_effect_annotator');
    expect(component.filteredAnnotatorTypes).toStrictEqual(['simple_effect_annotator']);
    expect(component.annotatorStep.get('annotator').errors).toBeNull();
  });

  it('should request annotators and search invalid annotator', () => {
    component.requestAnnotators();
    expect(component.resourceAnnotators).toStrictEqual([
      new ResourceAnnotator('effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309'),
      new ResourceAnnotator('simple_effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309')
    ]);

    component.annotatorStep.get('annotator').setValue('geno');
    expect(component.filteredAnnotatorTypes).toStrictEqual([]);
    expect(component.annotatorStep.get('annotator').errors).toStrictEqual({invalidOption: true});
  });

  it('should select default annotator if the result is one', () => {
    jest.spyOn(pipelineEditorServiceMock, 'getResourceAnnotators')
      .mockReturnValueOnce(of(
        [new ResourceAnnotator('effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309')]
      ));
    const requestResourcesSpy = jest.spyOn(component, 'requestResources');
    component.requestAnnotators();
    expect(component.annotatorStep.get('annotator').value).toBe('effect_annotator');
    expect(requestResourcesSpy).toHaveBeenCalledWith();
    expect(component.annotatorTypes).toBeUndefined();
    expect(component.filteredAnnotatorTypes).toBeUndefined();
  });

  it('should get resources of an annotator and set default values', () => {
    component.resourceAnnotators = [
      new ResourceAnnotator('effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309'),
      new ResourceAnnotator('simple_effect_annotator', 'gene_models: hg19/gene_models/ccds_v201309')
    ];
    component.annotatorStep.setControl('annotator', new FormControl('effect_annotator'));
    component.requestResources();
    expect(component.annotatorConfig).toStrictEqual(annotatorConfigMock);
    expect(component.filteredResourceValues).toStrictEqual(
      new Map<string, string[]>([
        [
          'gene_models',
          [
            'hg19/gene_models/refGene_v20190211',
            'hg38/gene_models/GENCODE/34/basic/ALL',
            'hg38/gene_models/GENCODE/34/basic/CHR"'
          ]
        ],
        [
          'genome',
          ['hg38/genomes/GRCh38.p14', 't2t/genomes/t2t-chm13v2.0']
        ],
        [
          'input_annotatable',
          ['normalized_allele', 'hg19_annotatable']
        ]
      ]));
    expect(component.resourceStep).toBeDefined();
    expect(component.resourceStep.get('gene_models').value).toBe('hg19/gene_models/ccds_v201309');
    expect(component.resourceStep.get('genome').value).toBe('');
    expect(component.resourceStep.get('input_annotatable').value).toBe('');
  });

  it('should get attributes', () => {
    component.resourceStep.setControl('gene_models', new FormControl('hg19/gene_models/ccds_v201309'));
    component.resourceStep.setControl('genome', new FormControl(null));
    component.resourceStep.setControl('input_annotatable', new FormControl(null));
    component.annotatorStep.setControl('annotator', new FormControl('effect_annotator'));
    const getAttributesSpy = jest.spyOn(pipelineEditorServiceMock, 'getAttributes');
    const nextStepSpy = jest.spyOn(component.stepper, 'next');

    component.requestAttributes();
    expect(getAttributesSpy).toHaveBeenCalledWith(
      'pipelineId',
      'effect_annotator',
      // eslint-disable-next-line camelcase
      { gene_models: 'hg19/gene_models/ccds_v201309' }
    );
    expect(component.annotatorAttributes).toStrictEqual(attributesMock);
    expect(component.selectedAttributes).toStrictEqual(attributesMock);
    expect(nextStepSpy).toHaveBeenCalledWith();
  });

  it('should get final yaml text', () => {
    component.resourceStep.setControl('gene_models', new FormControl('hg19/gene_models/ccds_v201309'));
    component.resourceStep.setControl('genome', new FormControl('t2t/genomes/t2t-chm13v2.0'));
    component.resourceStep.setControl('input_annotatable', new FormControl(null));
    component.annotatorStep.setControl('annotator', new FormControl('effect_annotator'));
    const getAnnotatorYmlSpy = jest.spyOn(pipelineEditorServiceMock, 'getAnnotatorYml');
    const closeModalSpy = jest.spyOn(mockMatDialogRef, 'close');
    component.selectedAttributes = [attributesMock[0]];

    component.onFinish();
    expect(getAnnotatorYmlSpy).toHaveBeenCalledWith(
      'effect_annotator',
      // eslint-disable-next-line camelcase
      { gene_models: 'hg19/gene_models/ccds_v201309', genome: 't2t/genomes/t2t-chm13v2.0'},
      [new AnnotatorAttribute('attribute1', 'string', 'source1', false, true)]
    );

    expect(closeModalSpy).toHaveBeenCalledWith('\n' + ymlResponse);
  });

  it('should clear annotator value in form', () => {
    component.annotatorStep.setControl('annotator', new FormControl('gene_set_annotator'));
    component.clearAnnotator();
    expect(component.annotatorStep.get('annotator').value).toBeNull();
  });

  it('should clear resource value in all forms', () => {
    // step 3 resource controls
    component.resourceStep.setControl('resource_id', new FormControl('gene_properties/gene_scores/RVIS'));
    component.clearResource('resource_id');
    expect(component.resourceStep.get('resource_id').value).toBeNull();

    // step 1 resource control
    component.resourceTypeStep.setControl('resourceId', new FormControl('gene_properties/gene_scores/RVIS'));
    component.clearResource();
    expect(component.resourceTypeStep.get('resourceId').value).toBeNull();
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
});
