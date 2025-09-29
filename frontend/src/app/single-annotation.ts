
export class Variant {
  public constructor(
    public chromosome: string,
    public position: string,
    public reference: string,
    public alernative: string,
    public variantType: string
  ) {}

  public static fromJson(json: object): Variant {
    if (!json) {
      return undefined;
    }

    return new Variant(
      json['chromosome'] as string,
      json['position'] as string,
      json['reference'] as string,
      json['alternative'] as string,
      json['variant_type'] as string,
    );
  }
}

export class Annotator {
  public constructor(
    public annotatorType: AnnotatorType,
    public scores: Score[],
  ) {}

  public static fromJsonArray(jsonArray: object[]): Annotator[] {
    if (!jsonArray) {
      return undefined;
    }
    return jsonArray.map((json) => Annotator.fromJson(json));
  }

  public static fromJson(json: object): Annotator {
    if (!json) {
      return undefined;
    }

    return new Annotator(
      json['annotator_type'] as AnnotatorType,
      Score.fromJsonArray(json['scores'] as object[]),
    );
  }
}

export interface AnnotatorType {
  name: string;
  description: string;
  resourceLink: string;
}

export class Score {
  public constructor(
    public name: string,
    public description: string,
    public histogram: NumberHistogram,
    public help: string,
  ) {}

  public static fromJsonArray(jsonArray: object[]): Score[] {
    if (!jsonArray) {
      return undefined;
    }
    return jsonArray.map((json) => Score.fromJson(json));
  }

  public static fromJson(json: object): Score {
    if (!json) {
      return undefined;
    }

    return new Score(
      json['name'] as string,
      json['description'] as string,
      NumberHistogram.fromJson(json['histogram'] as object),
      json['help'] as string,
    );
  }
}

export class NumberHistogram {
  public constructor(
    public readonly bars: number[],
    public readonly bins: number[],
    public readonly largeValuesDesc: string,
    public readonly smallValuesDesc: string,
    public readonly rangeMin: number,
    public readonly rangeMax: number,
    public readonly logScaleX: boolean,
    public readonly logScaleY: boolean,
  ) {
    if (bins.length === (bars.length + 1)) {
      bars.push(0);
    }
  }

  public static fromJson(json: object): NumberHistogram {
    if (!json) {
      return undefined;
    }

    return new NumberHistogram(
      json['bars'] as number[],
      json['bins'] as number[],
      json['small_values_desc'] as string,
      json['large_values_desc'] as string,
      json['config']['view_range']['min'] as number,
      json['config']['view_range']['max'] as number,
      json['config']['x_log_scale'] as boolean,
      json['config']['y_log_scale'] as boolean,
    );
  }
}

export class SingleAnnotationReport {
  public constructor(
    public variant: Variant,
    public annotators: Annotator[],
  ) {}

  public static fromJson(json: object): SingleAnnotationReport {
    if (!json) {
      return undefined;
    }

    return new SingleAnnotationReport(
      Variant.fromJson(json['variant'] as object),
      Annotator.fromJsonArray(json['annotators'] as object[]),
    );
  }
}