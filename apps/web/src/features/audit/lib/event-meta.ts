import type { AuditEventType } from "@commit-analyzer/contracts";
import {
  Activity,
  Eraser,
  KeyRound,
  KeySquare,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export const eventIcon = (eventType: string): LucideIcon => {
  switch (eventType as AuditEventType) {
    case "auth.login":
      return LogIn;
    case "auth.logout":
      return LogOut;
    case "apikey.created":
      return KeySquare;
    case "apikey.revoked":
      return KeySquare;
    case "llmkey.upserted":
      return KeyRound;
    case "llmkey.deleted":
      return KeyRound;
    case "policy.activated":
      return ShieldCheck;
    case "generation.completed":
      return Sparkles;
    case "generation.failed":
      return TriangleAlert;
    case "repo.purged":
      return Eraser;
    default:
      return Activity;
  }
};

const KNOWN_EVENT_KEYS = new Set<AuditEventType>([
  "auth.login",
  "auth.logout",
  "apikey.created",
  "apikey.revoked",
  "llmkey.upserted",
  "llmkey.deleted",
  "policy.activated",
  "generation.completed",
  "generation.failed",
  "repo.purged",
]);

export const eventTypeI18nKey = (
  eventType: string,
): AuditEventType | "unknown" =>
  KNOWN_EVENT_KEYS.has(eventType as AuditEventType)
    ? (eventType as AuditEventType)
    : "unknown";

export const describePayload = (
  eventType: string,
  payload: Record<string, unknown>,
):
  | { kind: "rich"; values: Record<string, string> }
  | { kind: "fallback" } => {
  const get = (k: string): string | null => {
    const v = payload[k];
    return typeof v === "string" || typeof v === "number"
      ? String(v)
      : null;
  };

  switch (eventType as AuditEventType) {
    case "auth.login": {
      const provider = get("provider");
      return provider
        ? { kind: "rich", values: { provider } }
        : { kind: "fallback" };
    }
    case "apikey.created": {
      const name = get("name");
      const prefix = get("key_prefix");
      if (name && prefix) return { kind: "rich", values: { name, prefix } };
      return { kind: "fallback" };
    }
    case "apikey.revoked": {
      const prefix = get("key_prefix");
      return prefix
        ? { kind: "rich", values: { prefix } }
        : { kind: "fallback" };
    }
    case "llmkey.upserted":
    case "llmkey.deleted": {
      const provider = get("provider");
      return provider
        ? { kind: "rich", values: { provider } }
        : { kind: "fallback" };
    }
    case "generation.completed": {
      const provider = get("provider");
      const tokens = get("tokens_used");
      if (provider && tokens) {
        return { kind: "rich", values: { provider, tokens } };
      }
      return { kind: "fallback" };
    }
    case "generation.failed": {
      const reason = get("reason");
      return reason
        ? { kind: "rich", values: { reason } }
        : { kind: "fallback" };
    }
    default:
      return { kind: "fallback" };
  }
};
