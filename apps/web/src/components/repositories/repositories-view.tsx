"use client";

import type {
  ConnectedRepo,
  GithubRepo,
} from "@commit-analyzer/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Github, Loader2, Plug, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  EmptyGitGraph,
  EmptyState,
} from "@/components/repositories/empty-state";
import { RepoCard } from "@/components/repositories/repo-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tsr } from "@/lib/api/tsr";

type Props = {
  userId: string;
  initialGithub: GithubRepo[];
  initialConnected: ConnectedRepo[];
};

type GithubEnvelope = {
  status: 200;
  body: { items: GithubRepo[] };
  headers: Headers;
};
type ConnectedEnvelope = {
  status: 200;
  body: { items: ConnectedRepo[] };
  headers: Headers;
};

const OPTIMISTIC_ID_PREFIX = "optimistic:";

export const RepositoriesView = ({
  userId,
  initialGithub,
  initialConnected,
}: Props) => {
  const t = useTranslations("repositories");
  const queryClient = useQueryClient();

  const githubKey = useMemo(
    () => ["repos", "github", userId] as const,
    [userId],
  );
  const connectedKey = useMemo(
    () => ["repos", "connected", userId] as const,
    [userId],
  );

  const githubQuery = tsr.repos.listGithub.useQuery({
    queryKey: [...githubKey],
    queryData: {},
    initialData: {
      status: 200,
      body: { items: initialGithub },
      headers: new Headers(),
    },
    staleTime: 0,
    retry: 0,
  });

  const connectedQuery = tsr.repos.listConnected.useQuery({
    queryKey: [...connectedKey],
    queryData: {},
    initialData: {
      status: 200,
      body: { items: initialConnected },
      headers: new Headers(),
    },
    staleTime: 0,
    retry: 0,
  });

  const githubHasError = githubQuery.isError;
  const connectedHasError = connectedQuery.isError;

  useEffect(() => {
    if (githubQuery.error) {
      // eslint-disable-next-line no-console
      console.error("[repos] listGithub error", githubQuery.error);
    }
  }, [githubQuery.error]);
  useEffect(() => {
    if (connectedQuery.error) {
      // eslint-disable-next-line no-console
      console.error("[repos] listConnected error", connectedQuery.error);
    }
  }, [connectedQuery.error]);

  const githubItems: GithubRepo[] =
    githubQuery.data?.body.items ?? initialGithub;
  const connectedItems: ConnectedRepo[] =
    connectedQuery.data?.body.items ?? initialConnected;

  const connectedByGithubId = useMemo(() => {
    const map = new Map<number, ConnectedRepo>();
    for (const r of connectedItems) map.set(r.githubRepoId, r);
    return map;
  }, [connectedItems]);

  const connectMutation = tsr.repos.connect.useMutation({
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

  const disconnectMutation = tsr.repos.disconnect.useMutation({
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

  const [pendingDisconnect, setPendingDisconnect] = useState<
    ConnectedRepo | null
  >(null);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {t("connected.title")}
              <Badge variant="secondary">{connectedItems.length}</Badge>
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("connected.subtitle")}
            </p>
          </div>
        </header>
        {connectedHasError ? (
          <ErrorCard message={t("error.load")} />
        ) : connectedItems.length === 0 ? (
          <EmptyState
            icon={<EmptyGitGraph />}
            title={t("connected.empty")}
            description={t("connected.emptyHelper")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {connectedItems.map((repo) => {
              const isDisconnecting =
                disconnectMutation.isPending &&
                disconnectMutation.variables?.params.repoId === repo.id;
              const isStub = repo.id.startsWith(OPTIMISTIC_ID_PREFIX);
              return (
                <RepoCard
                  key={repo.id}
                  fullName={repo.fullName}
                  defaultBranch={repo.defaultBranch}
                  isConnected
                  connectedLabel={t("badge.connected")}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDisconnect(repo)}
                      disabled={isDisconnecting || isStub}
                    >
                      {isDisconnecting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                      {t("actions.disconnect")}
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <header>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Github className="h-5 w-5" />
            {t("github.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("github.subtitle")}
          </p>
        </header>
        {githubHasError ? (
          <ErrorCard message={t("error.load")} />
        ) : githubItems.length === 0 ? (
          <EmptyState
            icon={<Github className="h-6 w-6" />}
            title={t("github.empty")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {githubItems.map((repo) => {
              const alreadyConnected =
                repo.connected ||
                connectedByGithubId.has(repo.githubRepoId);
              const isPending =
                connectMutation.isPending &&
                connectMutation.variables?.params.githubRepoId ===
                  repo.githubRepoId;
              return (
                <RepoCard
                  key={repo.githubRepoId}
                  fullName={repo.fullName}
                  description={repo.description}
                  defaultBranch={repo.defaultBranch}
                  isPrivate={repo.private}
                  isConnected={alreadyConnected}
                  privateLabel={t("badge.private")}
                  publicLabel={t("badge.public")}
                  connectedLabel={t("badge.connected")}
                  action={
                    <Button
                      type="button"
                      size="sm"
                      className="group/btn ml-auto relative overflow-hidden"
                      disabled={alreadyConnected || isPending}
                      onClick={() =>
                        connectMutation.mutate({
                          params: { githubRepoId: repo.githubRepoId },
                        })
                      }
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary via-fuchsia-500 to-primary bg-[length:200%_100%] opacity-0 transition-opacity group-hover/btn:animate-shimmer group-hover/btn:opacity-100"
                      />
                      <span className="relative z-10 inline-flex items-center gap-2">
                        {isPending ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Plug />
                        )}
                        {alreadyConnected
                          ? t("badge.connected")
                          : isPending
                            ? t("actions.connecting")
                            : t("actions.connect")}
                      </span>
                    </Button>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisconnect(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("disconnectDialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("disconnectDialog.description", {
                name: pendingDisconnect?.fullName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("disconnectDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDisconnect) {
                  disconnectMutation.mutate({
                    params: { repoId: pendingDisconnect.id },
                  });
                  setPendingDisconnect(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:brightness-110"
            >
              {t("disconnectDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const ErrorCard = ({ message }: { message: string }) => (
  <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
    <AlertCircle className="h-4 w-4 shrink-0" />
    <span>{message}</span>
  </div>
);
