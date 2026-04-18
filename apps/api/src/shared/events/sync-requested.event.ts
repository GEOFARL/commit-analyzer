export class SyncRequestedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly userId: string,
  ) {}
}
