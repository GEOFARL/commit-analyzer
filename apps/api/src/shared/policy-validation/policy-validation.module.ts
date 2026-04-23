import { Global, Module } from "@nestjs/common";

import { ValidatorService } from "./validator.service.js";

@Global()
@Module({
  providers: [ValidatorService],
  exports: [ValidatorService],
})
export class PolicyValidationModule {}
