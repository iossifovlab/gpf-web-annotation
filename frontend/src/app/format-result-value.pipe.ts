import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatResultValue'
})
export class FormatResultValuePipe implements PipeTransform {
  public transform(value: string | number | Map<string, string | number>): string {
    let result = '';
    if (value instanceof Map) {
      value.forEach((v, k) => {
        result += `${k}:${v}; `;
      });
    } if (typeof value === 'number') {
      result = value === 0 ? '0' : value.toPrecision(3);
    } else if (typeof value === 'string') {
      return value;
    }
    return result;
  }
}
