"use client";

import {
  auditEventTypes,
  type AuditEventType,
} from "@commit-analyzer/contracts";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_VALUE = "__all__";

type Props = {
  value: AuditEventType | null;
  onChange: (next: AuditEventType | null) => void;
  id?: string;
};

export const EventTypeFilter = ({ value, onChange, id }: Props) => {
  const t = useTranslations("settings.activity");
  const tEvents = useTranslations("settings.activity.events");

  return (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(next) => {
        onChange(next === ALL_VALUE ? null : (next as AuditEventType));
      }}
    >
      <SelectTrigger
        id={id}
        aria-label={t("filter.ariaLabel")}
        className="w-full sm:w-64"
      >
        <SelectValue placeholder={t("filter.all")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{t("filter.all")}</SelectItem>
        {auditEventTypes.map((eventType) => (
          <SelectItem key={eventType} value={eventType}>
            {tEvents(`${eventType}.label`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
