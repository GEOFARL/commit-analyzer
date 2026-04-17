export class SyncStartedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly userId: string,
    public readonly syncJobId: string,
  ) {}
}
