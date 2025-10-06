
export class Variant {
  public constructor(
    public chromosome: string,
    public position: number,
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
      json['position'] as number,
      json['reference'] as string,
      json['alternative'] as string,
      json['variant_type'] as string,
    );
  }
}

export class Annotator {
  public constructor(
    public details: AnnotatorDetails,
    public attributes: Attribute[],
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
      AnnotatorDetails.fromJson(json['details'] as object),
      Attribute.fromJsonArray(json['attributes'] as object[]),
    );
  }
}

export class AnnotatorDetails {
  public constructor(
    public name: string,
    public description: string,
    public resourceId: string,
  ) {}

  public static fromJson(json: object): AnnotatorDetails {
    if (!json) {
      return undefined;
    }

    return new AnnotatorDetails(
      json['name'] as string,
      json['description'] as string,
      json['resource_id'] as string,
    );
  }
}

export interface Result {
  value: string;
  histogram: NumberHistogram | CategoricalHistogram;
}

export class Attribute {
  public constructor(
    public name: string,
    public description: string,
    public result: Result,
    public help: string,
  ) {}

  public static fromJsonArray(jsonArray: object[]): Attribute[] {
    if (!jsonArray) {
      return undefined;
    }
    return jsonArray.map((json) => Attribute.fromJson(json));
  }

  public static fromJson(json: object): Attribute {
    if (!json) {
      return undefined;
    }

    let histogram: NumberHistogram | CategoricalHistogram;

    if ((json['result'] as Result).histogram) {
      histogram = this.isCategoricalHistogram(json['result'] as Result) ?
        CategoricalHistogram.fromJson((json['result'] as Result).histogram)
        : NumberHistogram.fromJson((json['result'] as Result).histogram);
    }

    return new Attribute(
      json['name'] as string,
      json['description'] as string,
      {
        value: (json['result'] as Result).value,
        histogram: histogram,
      },
      json['help'] as string,
    );
  }

  private static isCategoricalHistogram(result: Result): boolean {
    return result.histogram['config']['type'] === 'categorical';
  }
}

export class NumberHistogram {
  public constructor(
    public readonly bars: number[],
    public readonly bins: number[],
    public readonly smallValuesDesc: string,
    public readonly largeValuesDesc: string,
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

export class CategoricalHistogram {
  public constructor(
    public readonly values: {name: string, value: number}[],
    public readonly valueOrder: string[],
    public readonly largeValuesDesc: string,
    public readonly smallValuesDesc: string,
    public readonly logScaleY: boolean,
    public readonly labelRotation: number,
  ) { }

  public static fromJson(json: object): CategoricalHistogram {
    if (!json) {
      return undefined;
    }

    return new CategoricalHistogram(
      json['values'] as {name: string, value: number}[],
      json['value_order'] as string[],
      json['large_values_desc'] as string,
      json['small_values_desc'] as string,
      json['y_log_scale'] as boolean,
      json['label_rotation'] as number,
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