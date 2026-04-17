export class SyncFailedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly userId: string,
    public readonly syncJobId: string,
    public readonly errorMessage: string,
  ) {}
}
