import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hasLocale, type Messages } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

const messagesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "messages",
);

const cache = new Map<string, Messages>();

function loadMessages(locale: (typeof routing.locales)[number]): Messages {
  const cached = cache.get(locale);
  if (cached) return cached;

  const localeDir = join(messagesRoot, locale);
  const files = readdirSync(localeDir).filter((f) => f.endsWith(".json"));

  const merged: Partial<Messages> = {};
  const seen = new Set<string>();
  for (const file of files) {
    const namespace = file.replace(/\.json$/, "");
    if (seen.has(namespace)) {
      throw new Error(
        `[i18n] Duplicate namespace "${namespace}" in messages/${locale}/`,
      );
    }
    seen.add(namespace);
    const raw = readFileSync(join(localeDir, file), "utf8");
    (merged as Record<string, unknown>)[namespace] = JSON.parse(raw);
  }

  const messages = merged as Messages;
  cache.set(locale, messages);
  return messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: loadMessages(locale),
  };
});
