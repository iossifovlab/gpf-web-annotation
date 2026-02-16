import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatResultValue'
})
export class FormatResultValuePipe implements PipeTransform {
  public transform(value: string | number | Map<string, string | number> | string[], numberOfDigits?: number): string {
    let result = '';
    if (value instanceof Map) {
      value.forEach((v, k) => {
        if (typeof v === 'number') {
          result += `${k}:${this.formatNumber(v, numberOfDigits)}; `;
        } else {
          result += `${k}:${v}; `;
        }
      });
    } else if (typeof value === 'number') {
      result = this.formatNumber(value, numberOfDigits);
    } else if (typeof value === 'string') {
      return value;
    } else if (Array.isArray(value)) {
      return '[' + value.join(', ') + ']';
    }
    return result;
  }

  // python format
  private formatNumber(value: number, numberOfDigits: number): string {
    if (value.toString().length < numberOfDigits) {
      return value.toString();
    }

    let s = value.toPrecision(numberOfDigits);

    // Remove trailing zeros in mantissa
    s = s.replace(/(\.\d*?[1-9])0+e/, '$1e');
    s = s.replace(/\.0+e/, 'e');

    // Pad exponent to two digits
    s = s.replace(/e([+-])(\d)$/, 'e$10$2');

    return s;
  }
}
