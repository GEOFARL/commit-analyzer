import type { RestEndpointMethodTypes } from "@octokit/rest";

export type {
  PluggedOctokitInstance,
} from "../octokit/plugged-octokit.js";

export type AuthenticatedRepo =
  RestEndpointMethodTypes["repos"]["listForAuthenticatedUser"]["response"]["data"][number];

export type RepoById = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
