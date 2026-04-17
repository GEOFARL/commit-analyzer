export class RepoSyncedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly userId: string,
    public readonly syncJobId: string,
    public readonly commitsProcessed: number,
  ) {}
}
