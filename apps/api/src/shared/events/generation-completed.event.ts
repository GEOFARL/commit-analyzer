export class GenerationCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly generationId: string,
    public readonly provider: string,
    public readonly model: string,
    public readonly tokensUsed: number,
  ) {}
}
