import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "@plane/propel/emoji-icon-picker";

describe("project image logos", () => {
  it("renders uploaded images at the requested size", () => {
    const html = renderToStaticMarkup(
      createElement(Logo, {
        logo: { in_use: "image", image: { asset_id: "logo-id", url: "/api/assets/v2/static/logo-id/" } },
        size: 28,
      })
    );
    expect(html).toContain("<img");
    expect(html).toContain("/api/assets/v2/static/logo-id/");
    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
    expect(html).toContain("object-contain");
  });

  it("keeps emoji logos working", () => {
    const html = renderToStaticMarkup(createElement(Logo, { logo: { in_use: "emoji", emoji: { value: "128578" } } }));
    expect(html).toContain(String.fromCodePoint(128578));
    expect(html).not.toContain("<img");
  });

  it("keeps built-in icons working", () => {
    const html = renderToStaticMarkup(
      createElement(Logo, { logo: { in_use: "icon", icon: { name: "Home", color: "#123456" } }, type: "lucide" })
    );
    expect(html).toContain("<svg");
    expect(html).not.toContain("<img");
  });

  it("does not render an empty image URL", () => {
    const html = renderToStaticMarkup(createElement(Logo, { logo: { in_use: "image" } }));
    expect(html).not.toContain("<img");
    expect(html).toContain("bg-layer-1");
  });
});
