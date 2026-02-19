export class AnnotatorConfig {
  public constructor(
    public annotatorType: string,
    public resources: Resource[]
  ) { }

  public static fromJson(json: object): AnnotatorConfig {
    if (!json) {
      return undefined;
    }

    const resources: Resource[] = [];
    Object.keys(json).forEach(key => {
      if (key !== 'annotator_type') {
        resources.push(new Resource(
          key,
          /* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
          json[key]['field_type'] || '',
          json[key]['resource_type'] || '',
          json[key]['value'] || '',
          null,
          json[key]['optional'],
          json[key]['attribute_type'] || ''
          /* eslint-enable */
        ));
      }
    });


    return new AnnotatorConfig(
      json['annotator_type'] as string,
      resources,
    );
  }
}

export class Resource {
  public constructor(
    public key: string,
    public fieldType: 'resource' | 'string' | 'bool' | 'attribute',
    public resourceType: string,
    public defaultValue: string | boolean,
    public possibleValues: string[],
    public optional: boolean,
    public attributeType: string,
  ) { }
}


export class AnnotatorAttribute {
  public constructor(
    public name: string,
    public type: string,
    public source: string,
    public internal: boolean,
    public selectedByDefault: boolean,
  ) { }

  public static fromJsonArray(jsonArray: object[]): AnnotatorAttribute[] {
    if (!jsonArray) {
      return undefined;
    }
    return jsonArray.map((json) => AnnotatorAttribute.fromJson(json));
  }

  public static fromJson(json: object): AnnotatorAttribute {
    if (!json) {
      return undefined;
    }

    return new AnnotatorAttribute(
      json['name'] as string,
      json['type'] as string,
      json['source'] as string,
      json['internal'] as boolean,
      json['default'] as boolean
    );
  }
}