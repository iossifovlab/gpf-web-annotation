import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'keyValueDisplay'
})
export class KeyValueDisplayPipe implements PipeTransform {
  public transform(obj: Record<string, string> | null): string {
    if (!obj) {
      return '';
    }

    return Object.entries(obj).map(([k, v]) => {
      return v ? `${k}\n${v}` : '';
    }).join('\n\n');
  }
}