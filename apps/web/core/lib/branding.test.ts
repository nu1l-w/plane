import { describe, expect, it } from "vitest";
import { BRAND_NAME, brandText, brandTranslations } from "@plane/constants";

describe("product branding", () => {
  it("replaces legacy product names while preserving URLs and identifiers", () => {
    expect(brandText("Plane plane 星轴科技 星轴 Plane Software https://plane.so/docs @plane/ui Airplane")).toBe(
      `${BRAND_NAME} ${BRAND_NAME} ${BRAND_NAME} ${BRAND_NAME} ${BRAND_NAME} Software https://plane.so/docs @plane/ui Airplane`
    );
  });

  it("brands nested translation values without changing keys or the source", () => {
    const source = { Plane: { title: "Welcome to Plane", items: ["星轴科技", null, 42] } };
    expect(brandTranslations(source)).toEqual({
      Plane: { title: `Welcome to ${BRAND_NAME}`, items: [BRAND_NAME, null, 42] },
    });
    expect(source.Plane.title).toBe("Welcome to Plane");
  });
});
