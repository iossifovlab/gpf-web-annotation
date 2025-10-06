import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-helper-modal',
  templateUrl: './helper-modal.component.html',
  styleUrls: ['./helper-modal.component.css'],
  imports: [CommonModule, MarkdownComponent],
})
export class HelperModalComponent {
  public constructor(
    @Inject(MAT_DIALOG_DATA) public content: string,
  ) {}
}
