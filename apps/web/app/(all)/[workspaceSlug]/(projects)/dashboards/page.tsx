/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// components
import { useTranslation } from "@plane/i18n";
import { Breadcrumbs, Header } from "@plane/ui";
import { WorkspaceDashboardOverview } from "@/components/analytics/dashboard-overview";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { PageHead } from "@/components/core/page-title";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";

function WorkspaceDashboardsPage() {
  const { currentWorkspace } = useWorkspace();
  const { t } = useTranslation();
  const pageTitle = currentWorkspace?.name ? `${currentWorkspace.name} - ${t("workspace_dashboards")}` : undefined;

  return (
    <>
      <AppHeader
        header={
          <Header>
            <Header.LeftItem>
              <Breadcrumbs>
                <Breadcrumbs.Item component={<BreadcrumbLink label={t("workspace_dashboards")} />} />
              </Breadcrumbs>
            </Header.LeftItem>
          </Header>
        }
      />
      <ContentWrapper>
        <PageHead title={pageTitle} />
        <WorkspaceDashboardOverview />
      </ContentWrapper>
    </>
  );
}

export default observer(WorkspaceDashboardsPage);
