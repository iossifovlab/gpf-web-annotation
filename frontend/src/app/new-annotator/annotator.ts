export class AnnotatorConfig {
  public constructor(
    public annotatorType: string,
    public inputAnnotatable: string,
    public resources: Resource[]
  ) { }

  public static fromJson(json: object): AnnotatorConfig {
    if (!json) {
      return undefined;
    }

    const resources: Resource[] = [];
    Object.keys(json).forEach(key => {
      if (!['annotator_type', 'input_annotatable'].includes(key)) {
        resources.push(new Resource(
          key,
          json[key]['field_type'] || '',
          json[key]['resource_type'] || '',
          json[key]['value'] || '',
          null
        ));
      }
    });


    return new AnnotatorConfig(
      json['annotator_type'] as string,
      '',
      resources,
    );
  }
}

export class Resource {
  public constructor(
    public key: string,
    public fieldType: 'resource' | 'string' | 'bool',
    public resourceType: string,
    public defaultValue: string | boolean,
    public possibleValues: string[]
  ) { }
}