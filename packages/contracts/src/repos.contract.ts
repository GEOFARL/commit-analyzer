import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { errorEnvelopeSchema } from "./shared/error.js";

const c = initContract();

export const githubRepoSchema = z.object({
  githubRepoId: z.number().int().positive(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  private: z.boolean(),
  defaultBranch: z.string(),
  description: z.string().nullable(),
  htmlUrl: z.string().url(),
  connected: z.boolean(),
  pushedAt: z.string().datetime().nullable(),
  stargazersCount: z.number().int().nonnegative(),
  archived: z.boolean(),
});
export type GithubRepo = z.infer<typeof githubRepoSchema>;

export const connectedRepoSchema = z.object({
  id: z.string().uuid(),
  githubRepoId: z.number().int().positive(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  defaultBranch: z.string(),
  lastSyncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ConnectedRepo = z.infer<typeof connectedRepoSchema>;

export const reposContract = c.router(
  {
    listGithub: {
      method: "GET",
      path: "/repos/github",
      responses: {
        200: z.object({ items: z.array(githubRepoSchema) }),
        401: errorEnvelopeSchema,
        429: errorEnvelopeSchema,
        502: errorEnvelopeSchema,
      },
      summary: "List the authenticated user's GitHub repositories",
      metadata: { auth: "jwt" } as const,
    },
    listConnected: {
      method: "GET",
      path: "/repos",
      responses: {
        200: z.object({ items: z.array(connectedRepoSchema) }),
        401: errorEnvelopeSchema,
      },
      summary: "List repositories connected to the current user",
      metadata: { auth: "jwt" } as const,
    },
    connect: {
      method: "POST",
      path: "/repos/:githubRepoId/connect",
      pathParams: z.object({
        githubRepoId: z.coerce.number().int().positive(),
      }),
      body: c.noBody(),
      responses: {
        201: connectedRepoSchema,
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
        409: errorEnvelopeSchema,
      },
      summary: "Connect a GitHub repository to the current user",
      metadata: { auth: "jwt" } as const,
    },
    disconnect: {
      method: "DELETE",
      path: "/repos/:repoId",
      pathParams: z.object({ repoId: z.string().uuid() }),
      body: c.noBody(),
      responses: {
        204: c.noBody(),
        401: errorEnvelopeSchema,
        404: errorEnvelopeSchema,
      },
      summary: "Disconnect a repository",
      metadata: { auth: "jwt" } as const,
    },
  },
  { strictStatusCodes: true },
);
