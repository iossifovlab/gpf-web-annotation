import { FormatResultValuePipe } from './format-result-value.pipe';

describe('FormatResultValuePipe', () => {
  it('create an instance', () => {
    const pipe = new FormatResultValuePipe();
    expect(pipe).toBeTruthy();
  });

  it('should format string value', () => {
    const pipe = new FormatResultValuePipe();
    expect(pipe.transform('missense')).toBe('missense');
    expect(pipe.transform(
      'ENST00000376583.7:MTHFR:missense:263/697(Ala->Val)|ENST00000376585.6:MTHFR:missense:263/697(Ala->Val)'
    )).toBe('ENST00000376583.7:MTHFR:missense:263/697(Ala->Val)|ENST00000376585.6:MTHFR:missense:263/697(Ala->Val)');
  });

  it('should format number value', () => {
    const pipe = new FormatResultValuePipe();
    expect(pipe.transform(0, 3)).toBe('0');
    expect(pipe.transform(10, 3)).toBe('10');
    expect(pipe.transform(123, 3)).toBe('123');
    expect(pipe.transform(1234, 3)).toBe('1.23e+03');
    expect(pipe.transform(1234, 4)).toBe('1234');
    expect(pipe.transform(1801133, 3)).toBe('1.8e+06');
    expect(pipe.transform(0.32269200682640076, 3)).toBe('0.323');
  });

  it('should format value of type map with strings', () => {
    const pipe = new FormatResultValuePipe();
    const map = new Map<string, string>([['MTHFR', 'missense'], ['ABC', 'nonsense']]);
    expect(pipe.transform(map)).toBe('MTHFR:missense; ABC:nonsense; ');
  });

  it('should format value of type map with string and number', () => {
    const pipe = new FormatResultValuePipe();
    const map = new Map<string, number>([['MTHFR', 15454], ['ABC', 52]]);
    expect(pipe.transform(map, 3)).toBe('MTHFR:1.55e+04; ABC:52; ');
  });

  it('should format value of type array with strings', () => {
    const pipe = new FormatResultValuePipe();
    expect(pipe.transform(['MTHFR', 'ABC'])).toBe('[MTHFR, ABC]');
  });
});
