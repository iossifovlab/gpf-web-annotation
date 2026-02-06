import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewAnnotatorComponent } from './new-annotator.component';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

describe('NewAnnotatorComponent', () => {
  let component: NewAnnotatorComponent;
  let fixture: ComponentFixture<NewAnnotatorComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [NewAnnotatorComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: 'pipelineId' },
        provideHttpClient(),
        provideHttpClientTesting(),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NewAnnotatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
