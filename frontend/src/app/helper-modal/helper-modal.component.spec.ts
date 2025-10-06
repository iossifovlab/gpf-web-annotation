import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelperModalComponent } from './helper-modal.component';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideMarkdown } from 'ngx-markdown';

describe('HelperModalComponent', () => {
  let component: HelperModalComponent;
  let fixture: ComponentFixture<HelperModalComponent>;
  const mockMarkdown = '## Mock markdown\nThis is a **test**.';

  beforeEach(async() => {
    await TestBed.configureTestingModule({
      imports: [HelperModalComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockMarkdown },
        provideMarkdown()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HelperModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should check content', () => {
    expect(component.content).toBe('## Mock markdown\nThis is a **test**.');
  });
});
