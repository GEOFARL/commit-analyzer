export class ApiKeyRevokedEvent {
  constructor(
    public readonly apiKeyId: string,
    public readonly keyPrefix: string,
  ) {}
}
