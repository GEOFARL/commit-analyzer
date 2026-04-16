import { UnauthorizedException } from "@nestjs/common";

export class GithubTokenExpiredError extends UnauthorizedException {
  constructor(message = "github access token expired") {
    super({ message, code: "token_expired" });
  }
}
