export class SyncProgressEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly syncJobId: string,
    public readonly commitsProcessed: number,
    public readonly totalCommits: number,
  ) {}
}
