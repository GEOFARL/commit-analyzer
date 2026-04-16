"use client";

import type { ConnectedRepo } from "@commit-analyzer/contracts";
import { AlertCircle, Github, Loader2, Plug, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OPTIMISTIC_ID_PREFIX } from "@/features/repositories/constants";
import {
  useConnectedReposQuery,
  useConnectRepoMutation,
  useDisconnectRepoMutation,
  useGithubReposQuery,
} from "@/features/repositories/hooks";
import type { RepositoriesPageData } from "@/features/repositories/types";
import { useRepoFilters } from "@/features/repositories/use-repo-filters";

import { DisconnectDialog } from "./disconnect-dialog";
import { EmptyGitGraph } from "./empty-git-graph";
import { EmptyState } from "./empty-state";
import { RepoCard } from "./repo-card";
import { RepoCardSkeleton } from "./repo-card-skeleton";
import { RepoPagination } from "./repo-pagination";
import { RepoToolbar } from "./repo-toolbar";

const CONNECTED_SKELETON_COUNT = 3;
const GITHUB_SKELETON_COUNT = 6;

export const RepositoriesView = ({
  userId,
  initialGithub,
  initialConnected,
}: RepositoriesPageData) => {
  const t = useTranslations("repositories");

  const githubQuery = useGithubReposQuery(userId, initialGithub);
  const connectedQuery = useConnectedReposQuery(userId, initialConnected);
  const connectMutation = useConnectRepoMutation(userId);
  const disconnectMutation = useDisconnectRepoMutation(userId);

  const githubItems = githubQuery.data?.body.items ?? initialGithub;
  const connectedItems = connectedQuery.data?.body.items ?? initialConnected;

  const connectedByGithubId = useMemo(() => {
    const map = new Map<number, ConnectedRepo>();
    for (const r of connectedItems) map.set(r.githubRepoId, r);
    return map;
  }, [connectedItems]);

  const filters = useRepoFilters(githubItems);

  const filteredConnected = useMemo(() => {
    if (!filters.state.search.trim()) return connectedItems;
    const q = filters.state.search.trim().toLowerCase();
    return connectedItems.filter((r) =>
      r.fullName.toLowerCase().includes(q),
    );
  }, [connectedItems, filters.state.search]);

  const [pendingDisconnect, setPendingDisconnect] = useState<
    ConnectedRepo | null
  >(null);

  return (
    <div className="flex flex-col gap-6">
      <RepoToolbar
        state={filters.state}
        onSearchChange={filters.setSearch}
        onSortChange={filters.setSortBy}
        onVisibilityChange={filters.setVisibility}
        onArchivedChange={filters.setShowArchived}
      />

      <section className="flex flex-col gap-4">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              {t("connected.title")}
              <Badge variant="secondary">{filteredConnected.length}</Badge>
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("connected.subtitle")}
            </p>
          </div>
        </header>
        {connectedQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: CONNECTED_SKELETON_COUNT }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))}
          </div>
        ) : connectedQuery.isError ? (
          <ErrorCard message={t("error.load")} />
        ) : filteredConnected.length === 0 ? (
          <EmptyState
            icon={<EmptyGitGraph />}
            title={t("connected.empty")}
            description={t("connected.emptyHelper")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredConnected.map((repo) => {
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
            <Badge variant="secondary">{filters.totalFiltered}</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("github.subtitle")}
          </p>
        </header>
        {githubQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: GITHUB_SKELETON_COUNT }).map((_, i) => (
              <RepoCardSkeleton key={i} />
            ))}
          </div>
        ) : githubQuery.isError ? (
          <ErrorCard message={t("error.load")} />
        ) : filters.paginated.length === 0 ? (
          <EmptyState
            icon={<Github className="h-6 w-6" />}
            title={t("github.empty")}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filters.paginated.map((repo) => {
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
                    isArchived={repo.archived}
                    archivedLabel={t("badge.archived")}
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
            <RepoPagination
              page={filters.state.page}
              totalPages={filters.totalPages}
              totalFiltered={filters.totalFiltered}
              onPageChange={filters.setPage}
            />
          </>
        )}
      </section>

      <DisconnectDialog
        repo={pendingDisconnect}
        onClose={() => setPendingDisconnect(null)}
        onConfirm={(repo) => {
          disconnectMutation.mutate({ params: { repoId: repo.id } });
          setPendingDisconnect(null);
        }}
      />
    </div>
  );
};

const ErrorCard = ({ message }: { message: string }) => (
  <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
    <AlertCircle className="h-4 w-4 shrink-0" />
    <span>{message}</span>
  </div>
);
