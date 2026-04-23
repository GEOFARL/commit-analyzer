import type { ConnectedRepo } from "@commit-analyzer/contracts";

export type DashboardPageData = {
  userName: string | null;
  recentRepos: ConnectedRepo[];
  connectedCount: number;
  hasLlmKey: boolean;
};
