import { hasLocale, type Messages } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

async function loadMessages(locale: (typeof routing.locales)[number]): Promise<Messages> {
  const mod = (await import(`../../messages/${locale}.json`)) as { default: Messages };
  return mod.default;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
