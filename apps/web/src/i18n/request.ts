import { hasLocale, type Messages } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import en_analytics from "../../messages/en/analytics.json";
import en_apiKeys from "../../messages/en/apiKeys.json";
import en_auth from "../../messages/en/auth.json";
import en_common from "../../messages/en/common.json";
import en_dashboard from "../../messages/en/dashboard.json";
import en_errors from "../../messages/en/errors.json";
import en_generate from "../../messages/en/generate.json";
import en_landing from "../../messages/en/landing.json";
import en_llmKeys from "../../messages/en/llmKeys.json";
import en_login from "../../messages/en/login.json";
import en_metadata from "../../messages/en/metadata.json";
import en_nav from "../../messages/en/nav.json";
import en_placeholders from "../../messages/en/placeholders.json";
import en_policies from "../../messages/en/policies.json";
import en_profile from "../../messages/en/profile.json";
import en_repositories from "../../messages/en/repositories.json";
import en_sync from "../../messages/en/sync.json";
import en_userMenu from "../../messages/en/userMenu.json";
import uk_analytics from "../../messages/uk/analytics.json";
import uk_apiKeys from "../../messages/uk/apiKeys.json";
import uk_auth from "../../messages/uk/auth.json";
import uk_common from "../../messages/uk/common.json";
import uk_dashboard from "../../messages/uk/dashboard.json";
import uk_errors from "../../messages/uk/errors.json";
import uk_generate from "../../messages/uk/generate.json";
import uk_landing from "../../messages/uk/landing.json";
import uk_llmKeys from "../../messages/uk/llmKeys.json";
import uk_login from "../../messages/uk/login.json";
import uk_metadata from "../../messages/uk/metadata.json";
import uk_nav from "../../messages/uk/nav.json";
import uk_placeholders from "../../messages/uk/placeholders.json";
import uk_policies from "../../messages/uk/policies.json";
import uk_profile from "../../messages/uk/profile.json";
import uk_repositories from "../../messages/uk/repositories.json";
import uk_sync from "../../messages/uk/sync.json";
import uk_userMenu from "../../messages/uk/userMenu.json";

import { routing } from "./routing";

const messagesByLocale: Record<(typeof routing.locales)[number], Messages> = {
  en: {
    analytics: en_analytics,
    apiKeys: en_apiKeys,
    auth: en_auth,
    common: en_common,
    dashboard: en_dashboard,
    errors: en_errors,
    generate: en_generate,
    landing: en_landing,
    llmKeys: en_llmKeys,
    login: en_login,
    metadata: en_metadata,
    nav: en_nav,
    placeholders: en_placeholders,
    policies: en_policies,
    profile: en_profile,
    repositories: en_repositories,
    sync: en_sync,
    userMenu: en_userMenu,
  },
  uk: {
    analytics: uk_analytics,
    apiKeys: uk_apiKeys,
    auth: uk_auth,
    common: uk_common,
    dashboard: uk_dashboard,
    errors: uk_errors,
    generate: uk_generate,
    landing: uk_landing,
    llmKeys: uk_llmKeys,
    login: uk_login,
    metadata: uk_metadata,
    nav: uk_nav,
    placeholders: uk_placeholders,
    policies: uk_policies,
    profile: uk_profile,
    repositories: uk_repositories,
    sync: uk_sync,
    userMenu: uk_userMenu,
  },
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
