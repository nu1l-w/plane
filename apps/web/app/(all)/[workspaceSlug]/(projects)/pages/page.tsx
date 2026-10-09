/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { EUserPermissionsLevel, EPageAccess } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { EmptyStateDetailed } from "@plane/propel/empty-state";
import { PageIcon } from "@plane/propel/icons";
import { Button } from "@plane/propel/button";
import type { TPageNavigationTabs } from "@plane/types";
import { EUserWorkspaceRoles } from "@plane/types";
import { Breadcrumbs, Header } from "@plane/ui";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ListLayout } from "@/components/core/list";
import { PageHead } from "@/components/core/page-title";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { PageListBlock } from "@/components/pages/list/block";
import { PageTabNavigation } from "@/components/pages/list/tab-navigation";
import { PageSearchInput } from "@/components/pages/list/search-input";
import { PageOrderByDropdown } from "@/components/pages/list/order-by";
import { EPageStoreType, usePageStore } from "@/hooks/store";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

const getPageType = (pageType?: string | null): TPageNavigationTabs => {
  if (pageType === "private") return "private";
  if (pageType === "archived") return "archived";
  return "public";
};

function WorkspacePagesPage() {
  const { workspaceSlug } = useParams();
  const searchParams = useSearchParams();
  const slug = workspaceSlug.toString();
  const pageType = getPageType(searchParams.get("type"));
  const router = useAppRouter();
  const { t } = useTranslation();
  const { fetchWorkspacePages, createWorkspacePage, getWorkspacePageIdsByTab, filters, updateFilters } = usePageStore(
    EPageStoreType.PROJECT
  );
  const { allowPermissions } = useUserPermissions();
  const pageIds = getWorkspacePageIdsByTab(slug, pageType);
  const canCreatePage = allowPermissions(
    [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    slug
  );

  const { isLoading } = useSWR(`WORKSPACE_PAGES_${slug}_${pageType}`, () => fetchWorkspacePages(slug, pageType));

  const handleCreatePage = async () => {
    const page = await createWorkspacePage(slug, {
      name: "",
      access: pageType === "private" ? EPageAccess.PRIVATE : EPageAccess.PUBLIC,
      description_html: "<p></p>",
      description_json: {},
    });
    if (page?.id) router.push(`/${slug}/pages/${page.id}`);
  };

  return (
    <>
      <AppHeader
        header={
          <Header>
            <Header.LeftItem>
              <Breadcrumbs>
                <Breadcrumbs.Item
                  component={<BreadcrumbLink label={t("sidebar.pages")} icon={<PageIcon className="h-4 w-4" />} />}
                />
              </Breadcrumbs>
            </Header.LeftItem>
            {canCreatePage && (
              <Header.RightItem>
                <Button variant="primary" size="lg" onClick={handleCreatePage}>
                  {t("workspace_pages.create_page")}
                </Button>
              </Header.RightItem>
            )}
          </Header>
        }
      />
      <ContentWrapper>
        <PageHead title={t("sidebar.pages")} />
        <div className="flex h-full w-full flex-col overflow-hidden">
          <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-subtle px-4">
            <PageTabNavigation workspaceSlug={slug} pageType={pageType} />
            <div className="flex items-center gap-2">
              <PageSearchInput
                searchQuery={filters.searchQuery}
                updateSearchQuery={(value) => updateFilters("searchQuery", value)}
              />
              <PageOrderByDropdown
                sortBy={filters.sortBy}
                sortKey={filters.sortKey}
                onChange={(value) => {
                  if (value.key) updateFilters("sortKey", value.key);
                  if (value.order) updateFilters("sortBy", value.order);
                }}
              />
            </div>
          </div>
          <div className="h-full w-full overflow-hidden">
            {isLoading ? (
              <div className="py-8 text-center text-secondary">{t("common.loading")}</div>
            ) : pageIds.length === 0 && filters.searchQuery ? (
              <EmptyStateDetailed
                assetKey="search"
                title={t("common_empty_state.search.title")}
                description={t("common_empty_state.search.description")}
              />
            ) : pageIds.length === 0 ? (
              <EmptyStateDetailed
                assetKey="page"
                title={t(`workspace_pages.empty_state.${pageType}.title`)}
                description={t(`workspace_pages.empty_state.${pageType}.description`)}
                actions={
                  pageType !== "archived" && canCreatePage
                    ? [
                        {
                          label: t("workspace_pages.create_page"),
                          onClick: handleCreatePage,
                          variant: "primary",
                        },
                      ]
                    : undefined
                }
              />
            ) : (
              <ListLayout>
                {pageIds.map((pageId) => (
                  <PageListBlock key={pageId} pageId={pageId} storeType={EPageStoreType.PROJECT} />
                ))}
              </ListLayout>
            )}
          </div>
        </div>
      </ContentWrapper>
    </>
  );
}

export default observer(WorkspacePagesPage);
