import { TestBed } from '@angular/core/testing';
import { AnnotationPipelineService } from './annotation-pipeline.service';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { lastValueFrom, of, take } from 'rxjs';

describe('AnnotationPipelineService', () => {
  let service: AnnotationPipelineService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnnotationPipelineService,
        provideHttpClient(),
      ]
    });

    service = TestBed.inject(AnnotationPipelineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should check query params when saving pipeline', () => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of({name: 'pipeline-name'}));

    const config = `
      preamble:
        input_reference_genome: hg38/genomes/GRCh38-hg38
        summary: Clinical Annotation Pipeline 
        description: This is a pipeline to annotate with Clinical resources  

      annotators:
    
        - normalize_allele_annotator: genome: hg38/genomes/GRCh38-hg38'
    `;

    const formData = new FormData();
    const configFile = new File([config], 'config.yml');
    formData.append('name', 'pipeline-name');
    formData.append('config', configFile);

    const options = {
      headers: {
        'X-CSRFToken': ''
      },
      withCredentials: true
    };

    service.savePipeline('pipeline-name', config);

    expect(httpPostSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/user_pipeline',
      formData,
      options
    );
  });

  it('should save pipeline and get pipeline name as response', async() => {
    const httpPostSpy = jest.spyOn(HttpClient.prototype, 'post');
    httpPostSpy.mockReturnValue(of({name: 'pipeline-name'}));

    const config = `
      preamble:
        input_reference_genome: hg38/genomes/GRCh38-hg38
        summary: Clinical Annotation Pipeline 
        description: This is a pipeline to annotate with Clinical resources  

      annotators:
    
        - normalize_allele_annotator: genome: hg38/genomes/GRCh38-hg38'
    `;

    const postResponse = service.savePipeline('pipeline-name', config);

    const res = await lastValueFrom(postResponse.pipe(take(1)));
    expect(res).toBe('pipeline-name');
  });


  it('should delete pipeline by id', () => {
    const httpDelteSpy = jest.spyOn(HttpClient.prototype, 'delete');
    const options = {
      headers: {
        'X-CSRFToken': ''
      },
      withCredentials: true
    };

    service.deletePipeline('pipeline-name');

    expect(httpDelteSpy).toHaveBeenCalledWith(
      '//localhost:8000/api/user_pipeline?name=pipeline-name',
      options
    );
  });
});
