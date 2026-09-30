/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { LockKeyhole } from "lucide-react";
import { EUserPermissionsLevel, EPageAccess } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { PageIcon } from "@plane/propel/icons";
import { Button } from "@plane/propel/button";
import { EUserWorkspaceRoles } from "@plane/types";
import { Breadcrumbs, Header } from "@plane/ui";
import { getPageName } from "@plane/utils";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { EPageStoreType, usePageStore } from "@/hooks/store";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

function WorkspacePagesPage() {
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug.toString();
  const router = useAppRouter();
  const { t } = useTranslation();
  const { fetchWorkspacePages, createWorkspacePage } = usePageStore(EPageStoreType.PROJECT);
  const { allowPermissions } = useUserPermissions();
  const canCreatePage = allowPermissions(
    [EUserWorkspaceRoles.ADMIN, EUserWorkspaceRoles.MEMBER],
    EUserPermissionsLevel.WORKSPACE,
    slug
  );

  const { data: pages = [], isLoading } = useSWR(`WORKSPACE_PAGES_${slug}`, () => fetchWorkspacePages(slug));

  const handleCreatePage = async () => {
    const page = await createWorkspacePage(slug, {
      name: "",
      access: EPageAccess.PUBLIC,
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
                  {t("workspace_pages.empty_state.public.primary_button.text")}
                </Button>
              </Header.RightItem>
            )}
          </Header>
        }
      />
      <ContentWrapper>
        <PageHead title={t("sidebar.pages")} />
        <div className="mx-auto w-full max-w-4xl py-6">
          {isLoading ? (
            <div className="py-8 text-center text-secondary">{t("common.loading")}</div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <PageIcon className="h-8 w-8 text-tertiary" />
              <div>
                <h2 className="text-16 font-medium">{t("workspace_pages.empty_state.public.title")}</h2>
                <p className="mt-1 text-13 text-secondary">{t("workspace_pages.empty_state.public.description")}</p>
              </div>
              {canCreatePage && (
                <Button variant="primary" onClick={handleCreatePage}>
                  {t("workspace_pages.empty_state.public.primary_button.text")}
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-subtle">
              {pages.map((page) => (
                <Link
                  key={page.id}
                  href={`/${slug}/pages/${page.id}`}
                  className="flex items-center gap-3 py-4 text-13 hover:text-accent-primary"
                >
                  {page.access === EPageAccess.PRIVATE ? (
                    <LockKeyhole className="h-4 w-4 text-tertiary" />
                  ) : (
                    <PageIcon className="h-4 w-4 text-tertiary" />
                  )}
                  <span>{getPageName(page.name)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </ContentWrapper>
    </>
  );
}

export default observer(WorkspacePagesPage);
