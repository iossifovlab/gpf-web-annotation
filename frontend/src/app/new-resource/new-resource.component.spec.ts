import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewResourceComponent } from './new-resource.component';
import { provideHttpClient } from '@angular/common/http';

describe('NewResourceComponent', () => {
  let component: NewResourceComponent;
  let fixture: ComponentFixture<NewResourceComponent>;

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [NewResourceComponent],
      providers: [provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(NewResourceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
