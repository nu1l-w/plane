import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { IWorkspaceDashboardOverview } from "@/services/dashboard.service";

const translations = vi.hoisted(() => ({ t: (key: string): string => key }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => translations }));
vi.mock("next/link", () => ({ default: "a" }));
import { DashboardDistributions } from "./dashboard-distributions";

const require = createRequire(new URL("../../../../../packages/i18n/package.json", import.meta.url));
const { createInstance } = require("i18next");

describe("dashboard priority translations", () => {
  it.each(["zh-CN", "en"])("renders every priority using existing %s translations", async (language) => {
    const resources = Object.fromEntries(
      ["common", "home"].map((namespace) => [
        namespace,
        JSON.parse(
          readFileSync(
            new URL(`../../../../../packages/i18n/src/locales/${language}/${namespace}.json`, import.meta.url),
            "utf8"
          )
        ),
      ])
    );
    const instance = createInstance();
    await instance.init({
      lng: language,
      resources: { [language]: resources },
      defaultNS: "common",
      fallbackNS: ["home"],
      nsSeparator: false,
    });
    translations.t = (key: string) => instance.t(key);
    const data = {
      priorities: { urgent: 4, high: 3, medium: 1, low: 4, none: 12 },
      member_distribution: [],
    } as unknown as IWorkspaceDashboardOverview;
    const html = renderToStaticMarkup(
      createElement(DashboardDistributions, { workspaceSlug: "team", data, searchParams: new URLSearchParams() })
    );
    for (const label of ["P0", "P1", "P2", "P3", "P4"]) expect(html).toContain(`>${label}</span>`);
    expect(html).not.toMatch(/common\.(urgent|high|medium|low|none)/);
    expect(html).toContain("priority=urgent&amp;detail=open");
  });
});
