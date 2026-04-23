import type analytics from "../messages/en/analytics.json";
import type apiKeys from "../messages/en/apiKeys.json";
import type auth from "../messages/en/auth.json";
import type common from "../messages/en/common.json";
import type dashboard from "../messages/en/dashboard.json";
import type errors from "../messages/en/errors.json";
import type generate from "../messages/en/generate.json";
import type landing from "../messages/en/landing.json";
import type llmKeys from "../messages/en/llmKeys.json";
import type login from "../messages/en/login.json";
import type metadata from "../messages/en/metadata.json";
import type nav from "../messages/en/nav.json";
import type placeholders from "../messages/en/placeholders.json";
import type policies from "../messages/en/policies.json";
import type repositories from "../messages/en/repositories.json";
import type sync from "../messages/en/sync.json";
import type userMenu from "../messages/en/userMenu.json";

import type { routing } from "./i18n/routing";

type Messages = {
  analytics: typeof analytics;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  common: typeof common;
  dashboard: typeof dashboard;
  errors: typeof errors;
  generate: typeof generate;
  landing: typeof landing;
  llmKeys: typeof llmKeys;
  login: typeof login;
  metadata: typeof metadata;
  nav: typeof nav;
  placeholders: typeof placeholders;
  policies: typeof policies;
  repositories: typeof repositories;
  sync: typeof sync;
  userMenu: typeof userMenu;
};

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
  }
}
