import { TestBed } from '@angular/core/testing';

import { PipelineEditorService } from './pipeline-editor.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('PipelineEditorService', () => {
  let service: PipelineEditorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    });
    service = TestBed.inject(PipelineEditorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
