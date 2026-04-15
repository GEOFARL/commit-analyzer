"use client";

import type {
  ConnectedRepo,
  GithubRepo,
} from "@commit-analyzer/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

import { tsr } from "@/lib/api/tsr";

import { OPTIMISTIC_ID_PREFIX } from "./constants";
import { repositoryQueryKeys } from "./queries";
import type { ConnectedEnvelope, GithubEnvelope } from "./types";

export const useGithubReposQuery = (
  userId: string,
  initialItems: GithubRepo[],
) => {
  const query = tsr.repos.listGithub.useQuery({
    queryKey: [...repositoryQueryKeys.github(userId)],
    queryData: {},
    initialData: {
      status: 200,
      body: { items: initialItems },
      headers: new Headers(),
    },
    staleTime: 0,
    retry: 0,
  });

  useEffect(() => {
    if (query.error) {
      console.error("[repos] listGithub error", query.error);
    }
  }, [query.error]);

  return query;
};

export const useConnectedReposQuery = (
  userId: string,
  initialItems: ConnectedRepo[],
) => {
  const query = tsr.repos.listConnected.useQuery({
    queryKey: [...repositoryQueryKeys.connected(userId)],
    queryData: {},
    initialData: {
      status: 200,
      body: { items: initialItems },
      headers: new Headers(),
    },
    staleTime: 0,
    retry: 0,
  });

  useEffect(() => {
    if (query.error) {
      console.error("[repos] listConnected error", query.error);
    }
  }, [query.error]);

  return query;
};

export const useConnectRepoMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("repositories");
  const githubKey = repositoryQueryKeys.github(userId);
  const connectedKey = repositoryQueryKeys.connected(userId);

  return tsr.repos.connect.useMutation({
    onMutate: async (vars) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...githubKey] }),
        queryClient.cancelQueries({ queryKey: [...connectedKey] }),
      ]);
      const prevGithub = queryClient.getQueryData<GithubEnvelope>([
        ...githubKey,
      ]);
      const prevConnected = queryClient.getQueryData<ConnectedEnvelope>([
        ...connectedKey,
      ]);
      const target = prevGithub?.body.items.find(
        (r) => r.githubRepoId === vars.params.githubRepoId,
      );

      if (prevGithub) {
        queryClient.setQueryData<GithubEnvelope>([...githubKey], {
          ...prevGithub,
          body: {
            items: prevGithub.body.items.map((r) =>
              r.githubRepoId === vars.params.githubRepoId
                ? { ...r, connected: true }
                : r,
            ),
          },
        });
      }
      if (prevConnected && target) {
        const stub: ConnectedRepo = {
          id: `${OPTIMISTIC_ID_PREFIX}${target.githubRepoId}`,
          githubRepoId: target.githubRepoId,
          owner: target.owner,
          name: target.name,
          fullName: target.fullName,
          defaultBranch: target.defaultBranch,
          lastSyncedAt: null,
          createdAt: new Date().toISOString(),
        };
        queryClient.setQueryData<ConnectedEnvelope>([...connectedKey], {
          ...prevConnected,
          body: { items: [...prevConnected.body.items, stub] },
        });
      }
      return { prevGithub, prevConnected };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevGithub) {
        queryClient.setQueryData([...githubKey], context.prevGithub);
      }
      if (context?.prevConnected) {
        queryClient.setQueryData([...connectedKey], context.prevConnected);
      }
      toast.error(t("toast.connectError"));
    },
    onSuccess: (data) => {
      if (data.status === 201) {
        queryClient.setQueryData<ConnectedEnvelope>(
          [...connectedKey],
          (prev) => {
            const withoutStub =
              prev?.body.items.filter(
                (r) =>
                  !r.id.startsWith(OPTIMISTIC_ID_PREFIX) ||
                  r.githubRepoId !== data.body.githubRepoId,
              ) ?? [];
            return {
              status: 200,
              body: { items: [...withoutStub, data.body] },
              headers: prev?.headers ?? new Headers(),
            };
          },
        );
        toast.success(t("toast.connected"));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...githubKey] });
      void queryClient.invalidateQueries({ queryKey: [...connectedKey] });
    },
  });
};

export const useDisconnectRepoMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("repositories");
  const githubKey = repositoryQueryKeys.github(userId);
  const connectedKey = repositoryQueryKeys.connected(userId);

  return tsr.repos.disconnect.useMutation({
    onMutate: async (vars) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...connectedKey] }),
        queryClient.cancelQueries({ queryKey: [...githubKey] }),
      ]);
      const prevConnected = queryClient.getQueryData<ConnectedEnvelope>([
        ...connectedKey,
      ]);
      const prevGithub = queryClient.getQueryData<GithubEnvelope>([
        ...githubKey,
      ]);
      const removed = prevConnected?.body.items.find(
        (r) => r.id === vars.params.repoId,
      );
      if (prevConnected) {
        queryClient.setQueryData<ConnectedEnvelope>([...connectedKey], {
          ...prevConnected,
          body: {
            items: prevConnected.body.items.filter(
              (r) => r.id !== vars.params.repoId,
            ),
          },
        });
      }
      if (prevGithub && removed) {
        queryClient.setQueryData<GithubEnvelope>([...githubKey], {
          ...prevGithub,
          body: {
            items: prevGithub.body.items.map((r) =>
              r.githubRepoId === removed.githubRepoId
                ? { ...r, connected: false }
                : r,
            ),
          },
        });
      }
      return { prevConnected, prevGithub };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevConnected) {
        queryClient.setQueryData([...connectedKey], context.prevConnected);
      }
      if (context?.prevGithub) {
        queryClient.setQueryData([...githubKey], context.prevGithub);
      }
      toast.error(t("toast.disconnectError"));
    },
    onSuccess: () => {
      toast.success(t("toast.disconnected"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...connectedKey] });
      void queryClient.invalidateQueries({ queryKey: [...githubKey] });
    },
  });
};
