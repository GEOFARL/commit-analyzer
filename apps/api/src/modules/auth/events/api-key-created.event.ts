export class ApiKeyCreatedEvent {
  constructor(
    public readonly apiKeyId: string,
    public readonly name: string,
    public readonly keyPrefix: string,
  ) {}
}
