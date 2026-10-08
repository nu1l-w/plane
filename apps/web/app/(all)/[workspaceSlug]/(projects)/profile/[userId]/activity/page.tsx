/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
// components
import { PageHead } from "@/components/core/page-title";
import { DownloadActivityButton } from "@/components/profile/activity/download-button";
import { WeeklyReport } from "@/components/profile/activity/weekly-report";
import { WorkspaceActivityListPage } from "@/components/profile/activity/workspace-activity-list";
// hooks
import { useUserPermissions } from "@/hooks/store/user";

const PER_PAGE = 100;

function ProfileActivityPage() {
  // states
  const [pageCount, setPageCount] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [resultsCount, setResultsCount] = useState(0);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  // router
  const { allowPermissions } = useUserPermissions();
  //hooks
  const { t } = useTranslation();

  const updateTotalPages = (count: number) => setTotalPages(count);

  const updateResultsCount = (count: number) => setResultsCount(count);

  const handleLoadMore = () => setPageCount((prev) => prev + 1);

  const activityPages: React.ReactNode[] = [];
  for (let i = 0; i < pageCount; i++)
    activityPages.push(
      <WorkspaceActivityListPage
        key={i}
        cursor={`${PER_PAGE}:${i}:0`}
        perPage={PER_PAGE}
        updateResultsCount={updateResultsCount}
        updateTotalPages={updateTotalPages}
      />
    );

  const canDownloadActivity = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  return (
    <>
      <PageHead title="Profile - Activity" />
      <div className="flex h-full w-full flex-col overflow-hidden py-5">
        <div className="flex items-center justify-between gap-2 px-5 md:px-9">
          <h3 className="text-16 font-medium">
            {showWeeklyReport ? "生成周报" : t("profile.stats.recent_activity.title")}
          </h3>
          {canDownloadActivity && (
            <div className="flex items-center gap-2">
              {!showWeeklyReport && <DownloadActivityButton />}
              <Button
                variant={showWeeklyReport ? "secondary" : "primary"}
                onClick={() => setShowWeeklyReport((value) => !value)}
              >
                {showWeeklyReport ? "返回活动" : "生成周报"}
              </Button>
            </div>
          )}
        </div>
        {showWeeklyReport ? (
          <WeeklyReport />
        ) : (
          <div className="vertical-scrollbar flex scrollbar-md h-full flex-col overflow-y-auto px-5 md:px-9">
            {activityPages}
            {pageCount < totalPages && resultsCount !== 0 && (
              <div className="flex w-full items-center justify-center text-11">
                <Button variant="secondary" onClick={handleLoadMore}>
                  {t("common.load_more")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default observer(ProfileActivityPage);
