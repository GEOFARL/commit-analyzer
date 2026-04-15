import { GitBranch, Lock, Unlock } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RepoCardProps = {
  fullName: string;
  description?: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  isConnected?: boolean;
  privateLabel: string;
  publicLabel: string;
  connectedLabel?: string;
  action: ReactNode;
};

export const RepoCard = ({
  fullName,
  description,
  defaultBranch,
  isPrivate,
  isConnected,
  privateLabel,
  publicLabel,
  connectedLabel,
  action,
}: RepoCardProps) => (
  <Card
    className={cn(
      "group relative flex h-full flex-col overflow-hidden transition-all duration-300",
      "hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-primary/30",
    )}
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
    />
    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
      <div className="min-w-0 flex-1">
        <CardTitle className="truncate font-mono text-sm">
          {fullName}
        </CardTitle>
        {description ? (
          <CardDescription className="mt-1.5 line-clamp-2">
            {description}
          </CardDescription>
        ) : null}
      </div>
      {isConnected && connectedLabel ? (
        <Badge variant="success">{connectedLabel}</Badge>
      ) : null}
    </CardHeader>
    <CardContent className="flex flex-1 items-end gap-2 pb-4">
      <Badge variant="outline" className="gap-1">
        {isPrivate ? (
          <Lock className="h-3 w-3" />
        ) : (
          <Unlock className="h-3 w-3" />
        )}
        {isPrivate ? privateLabel : publicLabel}
      </Badge>
      <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
        <GitBranch className="h-3 w-3" />
        {defaultBranch}
      </Badge>
    </CardContent>
    <CardFooter className="border-t bg-muted/30 px-4 py-3">{action}</CardFooter>
  </Card>
);
