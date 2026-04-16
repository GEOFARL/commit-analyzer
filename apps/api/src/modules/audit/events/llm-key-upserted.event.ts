export class LlmKeyUpsertedEvent {
  constructor(
    public readonly userId: string,
    public readonly provider: string,
  ) {}
}
