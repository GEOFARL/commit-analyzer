export class GenerationFailedEvent {
  constructor(
    public readonly userId: string,
    public readonly generationId: string,
    public readonly reason: string,
  ) {}
}
