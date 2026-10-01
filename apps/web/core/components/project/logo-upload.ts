import { MAX_FILE_SIZE } from "@plane/constants";
import { EFileAssetType } from "@plane/types";
import type { TLogoProps } from "@plane/types";
import { FileService } from "@/services/file.service";

const fileService = new FileService();
export const PROJECT_LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

export const getProjectLogoFileError = (file: Pick<File, "type" | "size">): string | undefined => {
  if (!PROJECT_LOGO_ACCEPT.split(",").includes(file.type)) return "project_settings.general.logo.invalid_format";
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return "project_settings.general.logo.invalid_size";
  return undefined;
};

export const uploadProjectLogo = async (workspaceSlug: string, projectId: string, file: File): Promise<TLogoProps> => {
  const error = getProjectLogoFileError(file);
  if (error) throw new Error(error);
  const { asset_id, asset_url } = await fileService.uploadProjectAsset(
    workspaceSlug,
    projectId,
    { entity_type: EFileAssetType.PROJECT_LOGO, entity_identifier: projectId },
    file
  );
  return { in_use: "image", image: { asset_id, url: asset_url } };
};
