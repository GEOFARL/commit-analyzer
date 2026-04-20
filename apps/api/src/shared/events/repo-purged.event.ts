export class RepoPurgedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly userId: string,
    public readonly githubRepoId: string,
    public readonly deletedCommits: number,
  ) {}
}
