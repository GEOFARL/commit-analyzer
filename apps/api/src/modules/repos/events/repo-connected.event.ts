export class RepoConnectedEvent {
  constructor(
    public readonly repositoryId: string,
    public readonly userId: string,
    public readonly githubRepoId: string,
    public readonly fullName: string,
  ) {}
}
