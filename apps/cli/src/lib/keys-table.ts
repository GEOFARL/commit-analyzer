import type { ApiKey } from "@commit-analyzer/contracts";

export function formatKeysTable(items: ApiKey[]): string {
  if (items.length === 0) return "no api keys.\n";
  const rows = items.map((k) => ({
    name: k.name,
    prefix: k.prefix,
    lastUsed: k.lastUsedAt ?? "never",
    created: k.createdAt,
  }));
  const headers = { name: "NAME", prefix: "PREFIX", lastUsed: "LAST USED", created: "CREATED" };
  const widths = {
    name: Math.max(headers.name.length, ...rows.map((r) => r.name.length)),
    prefix: Math.max(headers.prefix.length, ...rows.map((r) => r.prefix.length)),
    lastUsed: Math.max(headers.lastUsed.length, ...rows.map((r) => r.lastUsed.length)),
    created: Math.max(headers.created.length, ...rows.map((r) => r.created.length)),
  };
  const line = (r: typeof headers): string =>
    `${r.name.padEnd(widths.name)}  ${r.prefix.padEnd(widths.prefix)}  ${r.lastUsed.padEnd(widths.lastUsed)}  ${r.created}\n`;
  return [headers, ...rows].map(line).join("");
}
