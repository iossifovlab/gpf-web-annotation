export class EffectDetail {
  public constructor(
    public gene: string,
    public effect: string,
    public transcript?: string,
    public details?: string) { }

  public static fromDetailValue(value: string): EffectDetail[] {
    return value.split('|').map(detail => {
      const details = detail.split(':');
      if (details.length === 4) {
        return new EffectDetail(
          details[1],
          details[2],
          details[0],
          details[3],
        );
      }
      return new EffectDetail(
        details[0],
        details[1],
      );
    }).sort((e1, e2) => {
      if (e1.gene < e2.gene) {
        return -1;
      }
      if (e1.gene > e2.gene) {
        return 1;
      }
      return 0;
    });
  }
}
