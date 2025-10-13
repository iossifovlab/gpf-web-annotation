import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { EffectDetail } from './effect-details';

@Component({
  selector: 'app-effect-table',
  imports: [CommonModule],
  templateUrl: './effect-table.component.html',
  styleUrl: './effect-table.component.css'
})
export class EffectTableComponent implements OnInit {
  @Input() public source: string;
  @Input() public rawEffectDetails: string;
  public effectDetails: EffectDetail[] = null;
  public isFullData = false;

  public ngOnInit(): void {
    this.effectDetails = EffectDetail.fromDetailValue(this.rawEffectDetails);
    this.isFullData = this.source === 'effect_details';
  }
}
