export class RepoDisconnectedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly userId: string,
    public readonly githubRepoId: string,
  ) {}
}
