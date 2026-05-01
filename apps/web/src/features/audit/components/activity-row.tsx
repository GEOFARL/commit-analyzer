"use client";

import type { AuditEventDto } from "@commit-analyzer/contracts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  describePayload,
  eventIcon,
  eventTypeI18nKey,
} from "../lib/event-meta";

import { PayloadPanel } from "./payload-panel";

type Props = {
  event: AuditEventDto;
};

export const ActivityRow = ({ event }: Props) => {
  const t = useTranslations("settings.activity");
  const tEvents = useTranslations("settings.activity.events");
  const format = useFormatter();
  const [open, setOpen] = useState(false);

  const i18nKey = eventTypeI18nKey(event.eventType);
  const Icon = eventIcon(event.eventType);
  const payload = event.payload ?? {};
  const desc = describePayload(event.eventType, payload);

  const description =
    desc.kind === "rich"
      ? tEvents(`${i18nKey}.description`, desc.values)
      : i18nKey === "unknown"
        ? tEvents("unknown.description", { eventType: event.eventType })
        : tEvents(`${i18nKey}.fallback`);

  const label = tEvents(`${i18nKey}.label`);
  const relative = format.relativeTime(new Date(event.createdAt), new Date());
  const absolute = format.dateTime(new Date(event.createdAt), {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <li
      className="flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors"
      data-testid="audit-row"
      data-event-type={event.eventType}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              <time dateTime={event.createdAt} title={absolute}>
                {relative}
              </time>
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-label={open ? t("togglePayload.hide") : t("togglePayload.show")}
          onClick={() => setOpen((v) => !v)}
          className="self-start sm:self-center"
        >
          {open ? (
            <ChevronUp aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          )}
          <span className="sr-only">
            {open ? t("togglePayload.hide") : t("togglePayload.show")}
          </span>
        </Button>
      </div>
      {open ? (
        <PayloadPanel
          payload={payload}
          ip={event.ip}
          userAgent={event.userAgent}
        />
      ) : null}
    </li>
  );
};
