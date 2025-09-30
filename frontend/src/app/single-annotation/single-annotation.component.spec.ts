import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleAnnotationComponent } from './single-annotation.component';

describe('SingleAnnotationComponent', () => {
  let component: SingleAnnotationComponent;
  let fixture: ComponentFixture<SingleAnnotationComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [SingleAnnotationComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SingleAnnotationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
