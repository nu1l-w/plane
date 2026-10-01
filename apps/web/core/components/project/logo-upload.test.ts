import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILE_SIZE } from "@plane/constants";
import { EFileAssetType } from "@plane/types";
import { getProjectLogoFileError, uploadProjectLogo } from "./logo-upload";

const upload = vi.hoisted(() => vi.fn());
vi.mock("@/services/file.service", () => ({
  FileService: class {
    uploadProjectAsset = upload;
  },
}));

describe("project logo upload", () => {
  beforeEach(() => {
    upload.mockReset();
  });

  it.each(["image/png", "image/jpeg", "image/webp"])("accepts %s up to 5 MB", (type) => {
    expect(getProjectLogoFileError({ type, size: MAX_FILE_SIZE })).toBeUndefined();
  });

  it.each(["image/svg+xml", "image/gif", "text/html", ""])("rejects unsupported type %s", (type) => {
    expect(getProjectLogoFileError({ type, size: 100 })).toBe("project_settings.general.logo.invalid_format");
  });

  it.each([0, -1, MAX_FILE_SIZE + 1])("rejects invalid size %s", (size) => {
    expect(getProjectLogoFileError({ type: "image/png", size })).toBe("project_settings.general.logo.invalid_size");
  });

  it("uploads to the project and returns a persisted image logo", async () => {
    const file = new File(["image"], "logo.png", { type: "image/png" });
    upload.mockResolvedValue({ asset_id: "asset-1", asset_url: "/api/assets/v2/static/asset-1/" });
    const result = await uploadProjectLogo("workspace", "project-1", file);

    expect(upload).toHaveBeenCalledWith(
      "workspace",
      "project-1",
      { entity_type: EFileAssetType.PROJECT_LOGO, entity_identifier: "project-1" },
      file
    );
    expect(result).toEqual({
      in_use: "image",
      image: { asset_id: "asset-1", url: "/api/assets/v2/static/asset-1/" },
    });
  });

  it("does not send rejected files to storage", async () => {
    await expect(uploadProjectLogo("workspace", "project-1", new File(["svg"], "logo.svg"))).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
  });

  it("propagates upload failures instead of returning a logo to save", async () => {
    upload.mockRejectedValue(new Error("Storage unavailable"));
    await expect(
      uploadProjectLogo("workspace", "project-1", new File(["image"], "logo.png", { type: "image/png" }))
    ).rejects.toThrow("Storage unavailable");
  });
});
