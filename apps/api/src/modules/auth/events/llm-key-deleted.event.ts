export class LlmKeyDeletedEvent {
  constructor(
    public readonly userId: string,
    public readonly provider: string,
  ) {}
}
