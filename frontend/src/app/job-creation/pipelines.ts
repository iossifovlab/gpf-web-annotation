export class Pipeline {
  public constructor(
    public id: string,
    public content: string
  ) {}

  public static fromJsonArray(jsonArray: object[]): Pipeline[] {
    if (!jsonArray) {
      return undefined;
    }
    return jsonArray.map((json) => Pipeline.fromJson(json));
  }

  public static fromJson(json: object): Pipeline {
    if (!json) {
      return undefined;
    }

    return new Pipeline(
      json['id'] as string,
      json['content'] as string
    );
  }
}