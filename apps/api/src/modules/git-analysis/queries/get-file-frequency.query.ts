export class GetFileFrequencyQuery {
  constructor(
    public readonly repoId: string,
    public readonly userId: string,
    public readonly limit: number,
  ) {}
}
