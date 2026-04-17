export class RepoRescoredEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly rescoreJobId: string,
    public readonly commitsProcessed: number,
  ) {}
}
