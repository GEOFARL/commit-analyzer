export class GetQualityScoresQuery {
  constructor(
    public readonly repoId: string,
    public readonly userId: string,
  ) {}
}
