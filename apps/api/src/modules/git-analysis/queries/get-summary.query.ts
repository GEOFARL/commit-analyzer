export class GetSummaryQuery {
  constructor(
    public readonly repoId: string,
    public readonly userId: string,
  ) {}
}
