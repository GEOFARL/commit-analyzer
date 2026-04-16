import type {
  ConnectedRepo,
  GithubRepo,
} from "@commit-analyzer/contracts";

export type GithubEnvelope = {
  status: 200;
  body: { items: GithubRepo[] };
  headers: Headers;
};

export type ConnectedEnvelope = {
  status: 200;
  body: { items: ConnectedRepo[] };
  headers: Headers;
};

export type RepositoriesPageData = {
  userId: string;
  initialGithub: GithubRepo[];
  initialConnected: ConnectedRepo[];
};
