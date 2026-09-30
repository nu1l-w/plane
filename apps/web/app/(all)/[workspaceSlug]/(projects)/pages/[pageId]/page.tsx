/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useMemo } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
import { EFileAssetType } from "@plane/types";
import type { TSearchEntityRequestPayload, TWebhookConnectionQueryParams } from "@plane/types";
import { useTranslation } from "@plane/i18n";
import { getButtonStyling } from "@plane/propel/button";
import { PageIcon } from "@plane/propel/icons";
import { Breadcrumbs, Header } from "@plane/ui";
import { cn, getPageName } from "@plane/utils";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { LogoSpinner } from "@/components/common/logo-spinner";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageRoot } from "@/components/pages/editor/page-root";
import type { TPageRootConfig, TPageRootHandlers } from "@/components/pages/editor/page-root";
import { PageHeaderActions } from "@/components/pages/header/actions";
import { PageSyncingBadge } from "@/components/pages/header/syncing-badge";
import { useEditorConfig } from "@/hooks/editor";
import { EPageStoreType, usePage, usePageStore } from "@/hooks/store";
import { useEditorAsset } from "@/hooks/store/use-editor-asset";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useAppRouter } from "@/hooks/use-app-router";
import { WorkspaceService } from "@/services/workspace.service";
import { WorkspacePageService } from "@/services/page/workspace-page.service";
import { ProjectPageVersionService } from "@/services/page";
import type { Route } from "./+types/page";

const workspaceService = new WorkspaceService();
const workspacePageService = new WorkspacePageService();
const pageVersionService = new ProjectPageVersionService();

function WorkspacePageDetailsPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, pageId } = params;
  const router = useAppRouter();
  const { t } = useTranslation();
  const { createWorkspacePage, fetchWorkspacePageDetails } = usePageStore(EPageStoreType.PROJECT);
  const page = usePage({ pageId, storeType: EPageStoreType.PROJECT });
  const { getWorkspaceBySlug } = useWorkspace();
  const { uploadEditorAsset, duplicateEditorAsset } = useEditorAsset();
  const { getEditorFileHandlers } = useEditorConfig();
  const workspaceId = getWorkspaceBySlug(workspaceSlug)?.id ?? "";
  const { error: pageError } = useSWR(`WORKSPACE_PAGE_${pageId}`, () =>
    fetchWorkspacePageDetails(workspaceSlug, pageId)
  );

  const fetchEntity = useCallback(
    (payload: TSearchEntityRequestPayload) => workspaceService.searchEntity(workspaceSlug, payload),
    [workspaceSlug]
  );

  const pageRootHandlers: TPageRootHandlers = useMemo(
    () => ({
      create: (payload: Parameters<typeof createWorkspacePage>[1]) => {
        if (payload.parent) return Promise.resolve(undefined);
        return createWorkspacePage(workspaceSlug, payload);
      },
      fetchAllVersions: (id: string) => pageVersionService.fetchWorkspacePageVersions(workspaceSlug, id),
      fetchDescriptionBinary: () => workspacePageService.fetchDescriptionBinary(workspaceSlug, pageId),
      fetchEntity,
      fetchVersionDetails: (id: string, versionId: string) =>
        pageVersionService.fetchWorkspacePageVersion(workspaceSlug, id, versionId),
      restoreVersion: (id: string, versionId: string) =>
        pageVersionService.restoreWorkspacePageVersion(workspaceSlug, id, versionId),
      getRedirectionLink: (id?: string) => (id ? `/${workspaceSlug}/pages/${id}` : `/${workspaceSlug}/pages`),
      updateDescription: page?.updateDescription ?? (async () => {}),
    }),
    [createWorkspacePage, fetchEntity, page?.updateDescription, pageId, workspaceSlug]
  );

  const pageRootConfig: TPageRootConfig = useMemo(
    () => ({
      fileHandler: getEditorFileHandlers({
        uploadFile: async (blockId, file) => {
          const { asset_id } = await uploadEditorAsset({
            blockId,
            data: {
              entity_identifier: pageId,
              entity_type: EFileAssetType.PAGE_DESCRIPTION,
            },
            file,
            workspaceSlug,
          });
          return asset_id;
        },
        duplicateFile: async (assetId: string) => {
          const { asset_id } = await duplicateEditorAsset({
            assetId,
            entityId: pageId,
            entityType: EFileAssetType.PAGE_DESCRIPTION,
            workspaceSlug,
          });
          return asset_id;
        },
        workspaceId,
        workspaceSlug,
      }),
    }),
    [duplicateEditorAsset, getEditorFileHandlers, pageId, uploadEditorAsset, workspaceId, workspaceSlug]
  );

  const webhookConnectionParams: TWebhookConnectionQueryParams = useMemo(
    () => ({ documentType: "workspace_page", workspaceSlug }),
    [workspaceSlug]
  );

  useEffect(() => {
    if (page?.deleted_at) router.push(`/${workspaceSlug}/pages`);
  }, [page?.deleted_at, router, workspaceSlug]);

  if ((!page || !page.id) && !pageError) {
    return (
      <div className="grid size-full place-items-center">
        <LogoSpinner />
      </div>
    );
  }

  if (pageError || !page?.canCurrentUserAccessPage) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <h3 className="text-16 font-semibold">{t("common_empty_state.not_found.title")}</h3>
        <Link href={`/${workspaceSlug}/pages`} className={cn(getButtonStyling("secondary", "base"), "mt-5")}>
          {t("sidebar.pages")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <AppHeader
        header={
          <Header>
            <Header.LeftItem>
              <Breadcrumbs>
                <Breadcrumbs.Item
                  component={
                    <BreadcrumbLink
                      label={t("sidebar.pages")}
                      href={`/${workspaceSlug}/pages/`}
                      icon={<PageIcon className="h-4 w-4 text-tertiary" />}
                    />
                  }
                />
                <Breadcrumbs.Item component={<BreadcrumbLink label={getPageName(page.name)} />} />
              </Breadcrumbs>
            </Header.LeftItem>
            <Header.RightItem>
              <PageSyncingBadge syncStatus={page.isSyncingWithServer} />
              <PageHeaderActions page={page} storeType={EPageStoreType.PROJECT} />
            </Header.RightItem>
          </Header>
        }
      />
      <ContentWrapper>
        <PageHead title={page.name} />
        <div className="relative h-full w-full overflow-hidden">
          <PageRoot
            config={pageRootConfig}
            handlers={pageRootHandlers}
            storeType={EPageStoreType.PROJECT}
            page={page}
            webhookConnectionParams={webhookConnectionParams}
            workspaceSlug={workspaceSlug}
          />
        </div>
      </ContentWrapper>
    </>
  );
}

export default observer(WorkspacePageDetailsPage);
