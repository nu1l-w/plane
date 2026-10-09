import { describe, expect, it } from "vitest";
import { DEFAULT_QUICK_LINKS, getVisibleDefaultQuickLinks } from "./default-links";

describe("default quick links", () => {
  it("shows all built-in links to users without saved links", () => {
    expect(getVisibleDefaultQuickLinks([])).toEqual(DEFAULT_QUICK_LINKS);
  });

  it("hides a built-in link when the user already saved the same destination", () => {
    expect(getVisibleDefaultQuickLinks([{ url: "http://HUB.IKEEPFUN.COM/" }])).toEqual([
      DEFAULT_QUICK_LINKS[0],
      DEFAULT_QUICK_LINKS[2],
    ]);
  });

  it("keeps a built-in link when a saved link points to a different page on the same host", () => {
    expect(getVisibleDefaultQuickLinks([{ url: "https://hub.ikeepfun.com/docs" }])).toEqual(DEFAULT_QUICK_LINKS);
  });
});
