"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { redactPayload } from "@/lib/redact";

type Props = {
  payload: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
};

export const PayloadPanel = ({ payload, ip, userAgent }: Props) => {
  const t = useTranslations("settings.activity");

  const safe = useMemo(() => {
    const redacted = redactPayload(payload) as Record<string, unknown>;
    return JSON.stringify(redacted, null, 2);
  }, [payload]);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 text-xs">
      <div className="flex items-start gap-2 text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{t("redactedNote")}</p>
      </div>
      <pre
        className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-background p-2 font-mono text-[11px] leading-snug"
        data-testid="audit-payload-json"
      >
        {safe}
      </pre>
      {ip || userAgent ? (
        <dl className="grid gap-1 text-muted-foreground sm:grid-cols-2">
          {ip ? (
            <div className="flex gap-1">
              <dt className="font-medium">{t("ip")}:</dt>
              <dd className="font-mono">{ip}</dd>
            </div>
          ) : null}
          {userAgent ? (
            <div className="flex gap-1">
              <dt className="font-medium">{t("userAgent")}:</dt>
              <dd className="truncate" title={userAgent}>
                {userAgent}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
};
