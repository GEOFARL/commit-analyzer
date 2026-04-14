export class AuthLoggedInEvent {
  constructor(
    public readonly userId: string,
    public readonly provider: "github",
  ) {}
}
