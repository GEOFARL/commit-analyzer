import type { ConnectedRepo, PolicyDto } from "@commit-analyzer/contracts";

export type PoliciesListPageData = {
  userId: string;
  repo: ConnectedRepo;
  initialItems: PolicyDto[];
};

export type PolicyEditorPageData = {
  userId: string;
  repo: ConnectedRepo;
  initialPolicy: PolicyDto;
};

export type PolicyPickerPageData = {
  initialRepos: ConnectedRepo[];
};

export type PoliciesListEnvelope = {
  status: 200;
  body: { items: PolicyDto[] };
  headers: Headers;
};

export type PolicyDetailEnvelope = {
  status: 200;
  body: PolicyDto;
  headers: Headers;
};
