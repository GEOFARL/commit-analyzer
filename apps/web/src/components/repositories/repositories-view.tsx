"use client";

import type {
  ConnectedRepo,
  GithubRepo,
} from "@commit-analyzer/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Github, Loader2, Plug, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tsr } from "@/lib/api/tsr";

type Props = {
  initialGithub: GithubRepo[];
  initialConnected: ConnectedRepo[];
};

const GITHUB_KEY = ["repos", "github"] as const;
const CONNECTED_KEY = ["repos", "connected"] as const;

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

export const RepositoriesView = ({
  initialGithub,
  initialConnected,
}: Props) => {
  const t = useTranslations("repositories");
  const queryClient = useQueryClient();

  const githubQuery = tsr.repos.listGithub.useQuery({
    queryKey: [...GITHUB_KEY],
    queryData: {},
    initialData: {
      status: 200,
      body: { items: initialGithub },
      headers: new Headers(),
    },
    staleTime: 60_000,
  });

  const connectedQuery = tsr.repos.listConnected.useQuery({
    queryKey: [...CONNECTED_KEY],
    queryData: {},
    initialData: {
      status: 200,
      body: { items: initialConnected },
      headers: new Headers(),
    },
    staleTime: 60_000,
  });

  const githubItems = useMemo<GithubRepo[]>(() => {
    const data = githubQuery.data;
    return data && data.status === 200 ? data.body.items : initialGithub;
  }, [githubQuery.data, initialGithub]);

  const connectedItems = useMemo<ConnectedRepo[]>(() => {
    const data = connectedQuery.data;
    return data && data.status === 200 ? data.body.items : initialConnected;
  }, [connectedQuery.data, initialConnected]);

  const connectedByGithubId = useMemo(() => {
    const map = new Map<number, ConnectedRepo>();
    for (const r of connectedItems) map.set(r.githubRepoId, r);
    return map;
  }, [connectedItems]);

  const connectMutation = tsr.repos.connect.useMutation({
    onMutate: async (vars) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...GITHUB_KEY] }),
        queryClient.cancelQueries({ queryKey: [...CONNECTED_KEY] }),
      ]);
      const prevGithub = queryClient.getQueryData<GithubEnvelope>([
        ...GITHUB_KEY,
      ]);
      const prevConnected = queryClient.getQueryData<ConnectedEnvelope>([
        ...CONNECTED_KEY,
      ]);
      if (prevGithub) {
        queryClient.setQueryData<GithubEnvelope>([...GITHUB_KEY], {
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
      return { prevGithub, prevConnected };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevGithub) {
        queryClient.setQueryData([...GITHUB_KEY], context.prevGithub);
      }
      if (context?.prevConnected) {
        queryClient.setQueryData([...CONNECTED_KEY], context.prevConnected);
      }
      toast.error(t("toast.connectError"));
    },
    onSuccess: (data) => {
      if (data.status === 201) {
        queryClient.setQueryData<ConnectedEnvelope>(
          [...CONNECTED_KEY],
          (prev) => ({
            status: 200,
            body: {
              items: prev ? [...prev.body.items, data.body] : [data.body],
            },
            headers: prev?.headers ?? new Headers(),
          }),
        );
        toast.success(t("toast.connected"));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...GITHUB_KEY] });
      void queryClient.invalidateQueries({ queryKey: [...CONNECTED_KEY] });
    },
  });

  const disconnectMutation = tsr.repos.disconnect.useMutation({
    onMutate: async (vars) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...CONNECTED_KEY] }),
        queryClient.cancelQueries({ queryKey: [...GITHUB_KEY] }),
      ]);
      const prevConnected = queryClient.getQueryData<ConnectedEnvelope>([
        ...CONNECTED_KEY,
      ]);
      const prevGithub = queryClient.getQueryData<GithubEnvelope>([
        ...GITHUB_KEY,
      ]);
      const removed = prevConnected?.body.items.find(
        (r) => r.id === vars.params.repoId,
      );
      if (prevConnected) {
        queryClient.setQueryData<ConnectedEnvelope>([...CONNECTED_KEY], {
          ...prevConnected,
          body: {
            items: prevConnected.body.items.filter(
              (r) => r.id !== vars.params.repoId,
            ),
          },
        });
      }
      if (prevGithub && removed) {
        queryClient.setQueryData<GithubEnvelope>([...GITHUB_KEY], {
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
        queryClient.setQueryData([...CONNECTED_KEY], context.prevConnected);
      }
      if (context?.prevGithub) {
        queryClient.setQueryData([...GITHUB_KEY], context.prevGithub);
      }
      toast.error(t("toast.disconnectError"));
    },
    onSuccess: () => {
      toast.success(t("toast.disconnected"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...CONNECTED_KEY] });
      void queryClient.invalidateQueries({ queryKey: [...GITHUB_KEY] });
    },
  });

  const [pendingDisconnect, setPendingDisconnect] = useState<
    ConnectedRepo | null
  >(null);

  const githubError =
    githubQuery.isError ||
    (githubQuery.data && githubQuery.data.status !== 200);
  const connectedError =
    connectedQuery.isError ||
    (connectedQuery.data && connectedQuery.data.status !== 200);

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
        {connectedError ? (
          <ErrorCard message={t("error.load")} />
        ) : connectedItems.length === 0 ? (
          <EmptyState
            icon={<EmptyGitGraph />}
            title={t("connected.empty")}
            description={t("connected.emptyHelper")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {connectedItems.map((repo) => (
              <RepoCard
                key={repo.id}
                fullName={repo.fullName}
                defaultBranch={repo.defaultBranch}
                isPrivate={false}
                isConnected
                privateLabel={t("badge.private")}
                publicLabel={t("badge.public")}
                connectedLabel={t("badge.connected")}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDisconnect(repo)}
                    disabled={
                      disconnectMutation.isPending &&
                      disconnectMutation.variables?.params.repoId === repo.id
                    }
                  >
                    {disconnectMutation.isPending &&
                    disconnectMutation.variables?.params.repoId === repo.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                    {t("actions.disconnect")}
                  </Button>
                }
              />
            ))}
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
        {githubError ? (
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
        <AlertDialogTrigger asChild>
          <span className="hidden" />
        </AlertDialogTrigger>
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
