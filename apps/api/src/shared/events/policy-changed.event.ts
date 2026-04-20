export class PolicyChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly repositoryId: string,
    public readonly policyId: string,
  ) {}
}
