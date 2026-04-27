import type {
  DefaultPolicyTemplate,
  DefaultPolicyTemplateResponse,
} from "@commit-analyzer/contracts";

export type DefaultPolicyPageData = {
  userId: string;
  initialTemplate: DefaultPolicyTemplate | null;
};

export type DefaultPolicyEnvelope = {
  status: 200;
  body: DefaultPolicyTemplateResponse;
  headers: Headers;
};
