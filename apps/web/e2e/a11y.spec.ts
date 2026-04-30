import AxeBuilder from "@axe-core/playwright";

import { expect, test } from "./fixtures";
import { MOCK_SEEDED_REPO_ID } from "./mock-server";

type Route = {
  name: string;
  path: string;
  auth: boolean;
  ready?: (page: import("@playwright/test").Page) => Promise<void>;
};

const ROUTES: Route[] = [
  {
    name: "landing",
    path: "/",
    auth: false,
    ready: async (page) => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
  },
  {
    name: "login",
    path: "/login",
    auth: false,
    ready: async (page) => {
      await expect(page.getByText(/continue with github/i).first()).toBeVisible();
    },
  },
  {
    name: "dashboard",
    path: "/dashboard",
    auth: true,
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { name: /welcome back/i }),
      ).toBeVisible();
    },
  },
  {
    name: "repositories",
    path: "/repositories",
    auth: true,
    ready: async (page) => {
      await expect(
        page.getByRole("heading", { level: 1, name: "Repositories" }),
      ).toBeVisible();
    },
  },
  {
    name: "repo-detail",
    path: `/repositories/${MOCK_SEEDED_REPO_ID}`,
    auth: true,
  },
  { name: "generate", path: "/generate", auth: true },
  { name: "policies", path: "/policies", auth: true },
  { name: "history", path: "/history", auth: true },
  { name: "settings", path: "/settings", auth: true },
  { name: "settings-llm-keys", path: "/settings/llm-keys", auth: true },
  { name: "settings-api-keys", path: "/settings/api-keys", auth: true },
  {
    name: "settings-default-policy",
    path: "/settings/default-policy",
    auth: true,
  },
];

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function runAxe(target: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page: target })
    .withTags(AXE_TAGS)
    .analyze();
  const blocking = results.violations
    .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
    .map((v) => ({
      impact: v.impact,
      id: v.id,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    }));
  expect(blocking, "axe serious/critical violations").toEqual([]);
}

test.describe("axe a11y audit", () => {
  for (const route of ROUTES) {
    if (route.auth) {
      test(`${route.name} has zero serious/critical violations`, async ({
        authedPage,
      }) => {
        await authedPage.goto(route.path, { waitUntil: "load" });
        if (route.ready) await route.ready(authedPage);
        await runAxe(authedPage);
      });
    } else {
      test(`${route.name} has zero serious/critical violations`, async ({
        page,
      }) => {
        await page.goto(route.path, { waitUntil: "load" });
        if (route.ready) await route.ready(page);
        await runAxe(page);
      });
    }
  }
});
